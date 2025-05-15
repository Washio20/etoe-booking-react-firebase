import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Reservation, FirestoreTimestamp } from "@/types/reservation";
import { 
  toDate,
  isReservationDateMatch
} from "@/utils/date";

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
    
    // 优化limit参数处理，设置更大的默认值以一次性获取更多数据
    const requestedLimit = url.searchParams.get("limit");
    let limit = 500;
    
    if (requestedLimit) {
      const parsedLimit = parseInt(requestedLimit);
      // 确保limit是有效数字且在合理范围内
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        // 设置最大上限为1000
        limit = Math.min(parsedLimit, 1000);
      }
    }
    
    const status = url.searchParams.get("status");
    const roomType = url.searchParams.get("roomType");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const email = url.searchParams.get("email");
    const date = url.searchParams.get("date"); // 现在是 YYYY-MM-DD 格式
    const reservationId = url.searchParams.get("id"); // 预约ID

    // 日期处理 - 解析为Date对象
    let searchDate = null;
    if (date) {
      // 直接使用标准日期格式解析
      try {
        searchDate = new Date(date);
        // 验证日期有效性
        if (isNaN(searchDate.getTime())) {
          searchDate = null;
          console.error("无效的日期格式:", date);
        } else {
          console.log(`解析日期 ${date} -> ${searchDate.toISOString()}`);
        }
      } catch (error) {
        console.error("日期解析错误:", error);
      }
    }

    // 添加调试日志
    console.log("查询参数:", {
      limit,
      status,
      roomType,
      date, // 原始日期字符串
      email,
      reservationId,
      searchDate: searchDate?.toISOString(), // 解析后的日期对象
    });

    // 创建基础查询
    const reservationsRef = db.collection("reservations");
    
    // 如果指定了预约ID，直接查询该ID
    if (reservationId) {
      try {
        const reservationDoc = await reservationsRef.doc(reservationId).get();
        
        if (!reservationDoc.exists) {
          return NextResponse.json({ 
            reservations: [], 
            total: 0,
            message: "指定されたIDの予約が見つかりませんでした" 
          });
        }
        
        const data = reservationDoc.data();
        const reservation = {
          id: reservationDoc.id,
          ...data,
          createdAt: data?.createdAt,
          bookingDate: data?.bookingDate || null,
          startDateTime: data?.startDateTime || null,
          endDateTime: data?.endDateTime || null,
          slowRoomStartDateTime: data?.slowRoomStartDateTime || null,
          slowRoomEndDateTime: data?.slowRoomEndDateTime || null,
          price: data?.price || 0,
        } as Reservation;
        
        // 获取用户信息
        if (reservation.userId) {
          try {
            const userDoc = await db.collection("users").doc(reservation.userId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              if (userData && userData.fullName) {
                reservation.userFullName = userData.fullName;
              }
            }
          } catch (error) {
            console.error(`获取用户ID ${reservation.userId} 信息失败:`, error);
          }
        }
        
        return NextResponse.json({
          reservations: [reservation],
          total: 1
        });
      } catch (error) {
        console.error("Error retrieving reservation by ID:", error);
        return NextResponse.json(
          { error: "予約IDでの検索中にエラーが発生しました" },
          { status: 500 }
        );
      }
    }
    
    // 初始查询
    let query = reservationsRef.orderBy("createdAt", "desc");
    
    // 邮箱搜索
    if (email) {
      query = reservationsRef
        .where("userEmail", ">=", email)
        .where("userEmail", "<=", email + "\uf8ff") // 使用Firebase的范围查询
        .orderBy("userEmail")
        .orderBy("createdAt", "desc");
    }
    
    // 状态过滤
    if (status) {
      query = reservationsRef
        .where("paymentStatus", "==", status)
        .orderBy("createdAt", "desc");
    }
    
    // 房间类型过滤
    if (roomType) {
      query = reservationsRef
        .where("roomType", "==", roomType)
        .orderBy("createdAt", "desc");
    }
    
    // 日期过滤 - 如果bookingDate字段是Firestore Timestamp类型
    if (searchDate) {
      try {
        // 设置日期范围为当天的开始和结束
        const startOfDay = new Date(searchDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(searchDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log("使用Firestore查询过滤日期范围:", startOfDay, "to", endOfDay);
        
        query = reservationsRef
          .where("bookingDate", ">=", startOfDay)
          .where("bookingDate", "<=", endOfDay)
          .orderBy("bookingDate")
          .orderBy("createdAt", "desc");
          
        console.log("使用bookingDate字段直接在Firestore中查询");
      } catch (error) {
        console.error("设置日期查询条件时出错:", error);
        // 发生错误时回退到基本查询
        query = reservationsRef.orderBy("createdAt", "desc");
      }
    }
    
    // 应用limit限制
    const allReservationsSnapshot = await query.limit(limit).get();
    console.log(`查询返回 ${allReservationsSnapshot.size} 条记录`);

    // 转换查询结果
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

    // 后处理 - 对于某些情况，我们可能需要在内存中进一步过滤
    // 下面的过滤只在未在数据库查询中处理的情况下执行
    
    // 内存中过滤 - 支付状态 (如果未在查询中处理)
    if (status && (!query || email)) {
      console.log("在内存中过滤支付状态:", status);
      reservations = reservations.filter((res) => res.paymentStatus === status);
    }

    // 内存中过滤 - 房间类型 (如果未在查询中处理)
    if (roomType && (!query || email || status)) {
      console.log("在内存中过滤房间类型:", roomType);
      reservations = reservations.filter((res) => res.roomType === roomType);
    }

    // 内存中过滤 - 日期 (针对displayDate或reservationDate字段)
    // 因为这些是字符串字段，Firestore查询无法直接处理
    if (searchDate) {
      // 检查是否已经通过bookingDate在查询中处理
      // 如果是邮箱、状态或房间类型查询，可能需要在内存中进行日期过滤
      const needsDateFiltering = email || (status && !roomType) || (roomType && !status);
      
      if (needsDateFiltering) {
        console.log("在内存中额外过滤日期 (针对displayDate/reservationDate字段)");
        
        // 将searchDate设置为当天的开始时间
        searchDate.setHours(0, 0, 0, 0);
        const searchTimestamp = searchDate.getTime();
        
        reservations = reservations.filter((res) => {
          // 跳过已经匹配bookingDate的记录
          if (res.bookingDate) {
            const bookingDateObj = toDate(res.bookingDate);
            if (bookingDateObj) {
              const bookingDay = new Date(bookingDateObj);
              bookingDay.setHours(0, 0, 0, 0);
              
              if (bookingDay.getTime() === searchTimestamp) {
                return true;
              }
            }
          }
          
          // 检查字符串日期字段
          const dateStr = res.displayDate || res.reservationDate;
          if (dateStr) {
            const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
            if (match) {
              const [_, year, month, day] = match;
              const resDate = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                0, 0, 0, 0
              );
              
              return resDate.getTime() === searchTimestamp;
            }
          }
          
          return false;
        });
        
        console.log("日期过滤后的预约数量:", reservations.length);
      }
    }

    return NextResponse.json({
      reservations,
      total: reservations.length
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
