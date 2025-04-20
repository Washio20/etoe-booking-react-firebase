import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Reservation, FirestoreTimestamp } from "@/types/reservation";
import { toDate } from "@/utils/date";

// 确保Firebase Admin已初始化
initAdmin();

// 获取所有预约列表
export async function GET(request: Request) {
  try {
    // 获取授权头部
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "認証トークンが必要です" },
        { status: 401 }
      );
    }

    // 提取令牌
    const idToken = authHeader.split("Bearer ")[1];

    // 验证Firebase ID令牌
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Firebase token verification failed:", error);
      return NextResponse.json(
        { error: "認証トークンが無効です" },
        { status: 401 }
      );
    }

    // 检查是否为管理员
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return NextResponse.json(
        { error: "管理者権限がありません" },
        { status: 403 }
      );
    }

    // 获取所有预约
    const db = getFirestore();

    // 获取URL查询参数
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const status = url.searchParams.get("status");
    const roomType = url.searchParams.get("roomType");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const email = url.searchParams.get("email");
    const date = url.searchParams.get("date");

    // 如果提供了单个date参数，将其同时设置为开始和结束日期
    const actualStartDate = startDate || date;
    const actualEndDate = endDate || date;

    // 添加调试日志
    console.log("查询参数:", {
      limit,
      status,
      roomType,
      startDate,
      endDate,
      email,
      date,
      actualStartDate,
      actualEndDate,
    });

    // 创建基础查询
    const reservationsRef = db.collection("reservations");

    // 执行查询 - 获取所有预约记录，然后在内存中过滤
    // 这样避免Firebase Admin的类型问题
    const allReservationsSnapshot = await reservationsRef
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    // 在内存中过滤结果
    let reservations: Reservation[] = allReservationsSnapshot.docs.map(
      (doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // 确保客户端可以使用createdAt
          createdAt: data.createdAt,
          // 时间字段处理
          bookingDate: data.bookingDate || null,
          startDateTime: data.startDateTime || null,
          endDateTime: data.endDateTime || null,
          slowRoomStartDateTime: data.slowRoomStartDateTime || null,
          slowRoomEndDateTime: data.slowRoomEndDateTime || null,
          // 确保价格字段正确
          price: data.price || 0,
        } as Reservation;
      }
    );

    // 收集所有预约的用户信息
    // 使用userId直接查询users表

    // 创建一个简单的缓存，减少重复查询
    const userIdToNameCache: { [userId: string]: string } = {};

    // 使用Promise.all并行处理所有预约
    const enhancedReservationsPromises = reservations.map(
      async (reservation) => {
        // 如果预约对象已经有userFullName，或者没有userId，则跳过
        if (reservation.userFullName || !reservation.userId) {
          return reservation;
        }

        const userId = reservation.userId;

        // 检查缓存中是否已有此userId对应的用户名
        if (userIdToNameCache[userId]) {
          return {
            ...reservation,
            userFullName: userIdToNameCache[userId],
          };
        }

        try {
          // 直接查询Firestore users表
          const userDoc = await db.collection("users").doc(userId).get();

          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData && userData.fullName) {
              // 存入缓存
              userIdToNameCache[userId] = userData.fullName;

              return {
                ...reservation,
                userFullName: userData.fullName,
              };
            }
          }

          // 如果在users表中没找到，返回原始数据
          return reservation;
        } catch (error) {
          console.error(`获取用户ID ${userId} 信息失败:`, error);
          return reservation;
        }
      }
    );

    // 等待所有预约处理完成
    reservations = await Promise.all(enhancedReservationsPromises);

    // 在内存中过滤 - 支付状态
    if (status) {
      reservations = reservations.filter((res) => res.paymentStatus === status);
    }

    // 在内存中过滤 - 房间类型
    if (roomType) {
      reservations = reservations.filter((res) => res.roomType === roomType);
    }

    // 在内存中过滤 - 邮箱
    if (email) {
      const emailLowerCase = email.toLowerCase();
      reservations = reservations.filter(
        (res) =>
          res.userEmail && res.userEmail.toLowerCase().includes(emailLowerCase)
      );
    }

    // 在内存中过滤 - 日期范围
    if (actualStartDate || actualEndDate) {
      console.log("过滤日期:", actualStartDate, actualEndDate);

      reservations = reservations.filter((res) => {
        let matchesFilter = true;

        // 优先使用bookingDate字段（Timestamp类型）
        if (res.bookingDate) {
          console.log("使用bookingDate字段过滤");
          const bookingDateObj = toDate(res.bookingDate);

          if (actualStartDate && bookingDateObj) {
            const [startYear, startMonth, startDay] = actualStartDate
              .split("-")
              .map(Number);
            const startFilterDate = new Date(
              startYear,
              startMonth - 1,
              startDay
            );

            if (bookingDateObj < startFilterDate) {
              matchesFilter = false;
            }
          }

          if (actualEndDate && matchesFilter && bookingDateObj) {
            const [endYear, endMonth, endDay] = actualEndDate
              .split("-")
              .map(Number);
            const endFilterDate = new Date(
              endYear,
              endMonth - 1,
              endDay,
              23,
              59,
              59
            );

            if (bookingDateObj > endFilterDate) {
              matchesFilter = false;
            }
          }

          return matchesFilter;
        }

        // 回退到处理旧的预约日期字符串（格式：YYYY年MM月DD日）
        const dateToCheck = res.displayDate || res.reservationDate;
        if (dateToCheck) {
          console.log("检查预约日期:", dateToCheck);

          const match = dateToCheck.match(/(\d+)年(\d+)月(\d+)日/);
          if (match) {
            const [_, year, month, day] = match;
            const resDate = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day)
            );

            console.log(
              "解析后的预约日期:",
              resDate.toISOString().split("T")[0]
            );

            if (actualStartDate) {
              const [startYear, startMonth, startDay] = actualStartDate
                .split("-")
                .map(Number);
              const startFilterDate = new Date(
                startYear,
                startMonth - 1,
                startDay
              );

              console.log(
                "过滤开始日期:",
                startFilterDate.toISOString().split("T")[0]
              );

              if (resDate < startFilterDate) {
                console.log("日期早于开始日期，不匹配");
                matchesFilter = false;
              }
            }

            if (actualEndDate && matchesFilter) {
              const [endYear, endMonth, endDay] = actualEndDate
                .split("-")
                .map(Number);
              const endFilterDate = new Date(
                endYear,
                endMonth - 1,
                endDay,
                23,
                59,
                59
              );

              console.log(
                "过滤结束日期:",
                endFilterDate.toISOString().split("T")[0]
              );

              if (resDate > endFilterDate) {
                console.log("日期晚于结束日期，不匹配");
                matchesFilter = false;
              }
            }
          } else {
            console.log("预约日期格式不匹配:", dateToCheck);
          }
        } else {
          console.log("预约没有日期");
        }

        return matchesFilter;
      });

      console.log("过滤后的预约数量:", reservations.length);
    }

    return NextResponse.json({
      reservations,
      total: reservations.length,
    });
  } catch (error) {
    console.error("Error retrieving reservations:", error);
    return NextResponse.json(
      { error: "予約の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
