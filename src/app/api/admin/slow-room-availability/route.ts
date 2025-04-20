import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { SLOW_ROOM_MAPPING } from "@/types/room";

// 确保Firebase Admin已初始化
initAdmin();

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";

export async function GET(req: Request) {
  try {
    // 获取授权头部
    const authHeader = req.headers.get("authorization");
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

    // 检查管理员权限
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    // 获取URL参数
    const url = new URL(req.url);
    const reservationId = url.searchParams.get("reservationId");

    if (!reservationId) {
      return NextResponse.json({ error: "予約IDは必須です" }, { status: 400 });
    }

    // 获取数据库实例
    const db = getFirestore();

    // 获取预约信息
    const reservationDoc = await db
      .collection("reservations")
      .doc(reservationId)
      .get();

    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: "予約が見つかりません" },
        { status: 404 }
      );
    }

    const reservation = reservationDoc.data();

    if (!reservation) {
      return NextResponse.json(
        { error: "予約データが無効です" },
        { status: 400 }
      );
    }

    // 检查是否确实为带有Slow Room的套餐预约
    if (!reservation.slowRoomAsSetPlan) {
      return NextResponse.json(
        { error: "この予約はセットプランのSlow Roomがありません" },
        { status: 400 }
      );
    }

    // 解析预约日期和Slow Room时间
    // 处理预约日期 - 支持新的bookingDate字段和旧的字段结构
    let bookingDate: Date | null = null;

    // 1. 优先使用新的bookingDate字段（Timestamp类型）
    if (reservation.bookingDate) {
      try {
        if (
          typeof reservation.bookingDate === "object" &&
          "seconds" in reservation.bookingDate
        ) {
          bookingDate = new Date(reservation.bookingDate.seconds * 1000);
          console.log(
            "使用bookingDate字段（Timestamp）:",
            bookingDate.toISOString()
          );
        } else {
          bookingDate = new Date(reservation.bookingDate);
          console.log(
            "使用bookingDate字段（日期字符串）:",
            bookingDate.toISOString()
          );
        }
      } catch (e) {
        console.error("解析bookingDate失败:", e);
        // 如果解析失败，尝试使用旧字段
      }
    }

    // 2. 如果未成功设置bookingDate，尝试旧字段
    if (!bookingDate) {
      const reservationDate = reservation.reservationDate || reservation.date;

      if (!reservationDate) {
        return NextResponse.json(
          { error: "予約データが不完全です" },
          { status: 400 }
        );
      }

      // 尝试解析旧式日期
      try {
        if (typeof reservationDate === "string") {
          // 尝试解析 YYYY年MM月DD日 格式
          const match = reservationDate.match(/(\d+)年(\d+)月(\d+)日/);
          if (match) {
            const [_, year, month, day] = match;
            bookingDate = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day)
            );
          }
          // 尝试解析 YYYY-MM-DD 格式
          else if (reservationDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            bookingDate = new Date(reservationDate);
          }
          // 尝试直接解析任何可以被Date构造函数识别的格式
          else {
            bookingDate = new Date(reservationDate);
          }
        }
        // 处理 Firestore Timestamp 对象
        else if (
          typeof reservationDate === "object" &&
          "seconds" in reservationDate
        ) {
          bookingDate = new Date(reservationDate.seconds * 1000);
        }
        // 其他未知格式
        else {
          bookingDate = new Date(reservationDate);
        }

        // 验证日期是否有效
        if (isNaN(bookingDate.getTime())) {
          throw new Error("Invalid date");
        }
      } catch (e) {
        console.error("日期解析失败:", reservationDate, e);
        return NextResponse.json(
          { error: "予約日付の形式が無効です" },
          { status: 400 }
        );
      }
    }

    // 确保已成功解析日期
    if (!bookingDate) {
      console.error("无法解析预约日期");
      return NextResponse.json(
        { error: "予約日付の解析に失敗しました" },
        { status: 400 }
      );
    }

    // 处理Slow Room时间 - 支持新的字段结构和旧的字段结构
    let slowRoomStartDateTime: Date, slowRoomEndDateTime: Date;

    // 1. 优先使用新的字段结构（slowRoomStartDateTime和slowRoomEndDateTime）
    if (reservation.slowRoomStartDateTime && reservation.slowRoomEndDateTime) {
      try {
        slowRoomStartDateTime =
          typeof reservation.slowRoomStartDateTime === "object" &&
          "seconds" in reservation.slowRoomStartDateTime
            ? new Date(reservation.slowRoomStartDateTime.seconds * 1000)
            : new Date(reservation.slowRoomStartDateTime);

        slowRoomEndDateTime =
          typeof reservation.slowRoomEndDateTime === "object" &&
          "seconds" in reservation.slowRoomEndDateTime
            ? new Date(reservation.slowRoomEndDateTime.seconds * 1000)
            : new Date(reservation.slowRoomEndDateTime);

        console.log("使用slowRoomStartDateTime和slowRoomEndDateTime字段:", {
          slowRoomStartDateTime: slowRoomStartDateTime.toISOString(),
          slowRoomEndDateTime: slowRoomEndDateTime.toISOString(),
        });
      } catch (e) {
        console.error("解析slowRoomStartDateTime/slowRoomEndDateTime失败:", e);
        // 如果解析失败，将继续尝试使用旧字段
        slowRoomStartDateTime = new Date(bookingDate);
        slowRoomEndDateTime = new Date(bookingDate);
      }
    } else {
      // 2. 如果没有使用新字段，初始化为当天日期，后续使用时间来设置
      slowRoomStartDateTime = new Date(bookingDate);
      slowRoomEndDateTime = new Date(bookingDate);

      // 尝试解析Slow Room时间
      let slowRoomStartStr = reservation.slowRoomStartTime;
      let slowRoomEndStr = reservation.slowRoomEndTime;

      // 如果使用了单一时间字符串格式 "XX:XX〜YY:YY"
      if ((!slowRoomStartStr || !slowRoomEndStr) && reservation.slowRoomTime) {
        const timeParts = reservation.slowRoomTime.split(/[〜~\-]/);
        if (timeParts.length === 2) {
          slowRoomStartStr = timeParts[0].trim();
          slowRoomEndStr = timeParts[1].trim();
        }
      }

      if (!slowRoomStartStr || !slowRoomEndStr) {
        return NextResponse.json(
          { error: "Slow Roomの時間情報が不完全です" },
          { status: 400 }
        );
      }

      // 解析Slow Room时间
      try {
        const startMatch = slowRoomStartStr.match(/(\d+):(\d+)/);
        const endMatch = slowRoomEndStr.match(/(\d+):(\d+)/);

        if (!startMatch || !endMatch) {
          throw new Error("Invalid time format");
        }

        const slowStartHour = parseInt(startMatch[1]);
        const slowStartMinute = parseInt(startMatch[2]);
        const slowEndHour = parseInt(endMatch[1]);
        const slowEndMinute = parseInt(endMatch[2]);

        slowRoomStartDateTime.setHours(slowStartHour, slowStartMinute, 0, 0);
        slowRoomEndDateTime.setHours(slowEndHour, slowEndMinute, 0, 0);
      } catch (e) {
        console.error("解析Slow Room时间失败:", e);
        return NextResponse.json(
          { error: "Slow Room時間の解析に失敗しました" },
          { status: 400 }
        );
      }
    }

    console.log(`检查Slow Room可用性: 预约ID=${reservationId}`);
    console.log(
      `Slow Room时间: ${slowRoomStartDateTime.toISOString()} - ${slowRoomEndDateTime.toISOString()}`
    );

    // 获取所有Slow Room的物理房间ID
    const slowRoomIds = SLOW_ROOM_MAPPING.slow_room || [];

    // 创建当天的日期范围用于查询
    const startOfDay = new Date(bookingDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(bookingDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 转换为Firestore Timestamp
    const startOfDayTimestamp = Timestamp.fromDate(startOfDay);
    const endOfDayTimestamp = Timestamp.fromDate(endOfDay);
    const slowRoomStartDateTimeTimestamp = Timestamp.fromDate(
      slowRoomStartDateTime
    );
    const slowRoomEndDateTimeTimestamp =
      Timestamp.fromDate(slowRoomEndDateTime);

    // 查询所有活跃的房间分配记录
    const assignmentsQuery = db
      .collection("roomAssignments")
      .where("status", "==", "active")
      .where("roomType", "==", "slow_room");

    const assignmentsSnapshot = await assignmentsQuery.get();

    // 记录所有在所请求时间段已被占用的Slow Room
    const occupiedRooms = new Set<string>();

    console.log(`搜索到 ${assignmentsSnapshot.size} 个Slow Room分配记录`);

    assignmentsSnapshot.forEach((doc) => {
      const assignment = doc.data();
      console.log(`分配记录: ${doc.id}`, assignment);

      // 解析分配记录的时间
      let assignmentStartObj, assignmentEndObj;

      // 处理不同格式的日期时间
      if (
        typeof assignment.startDateTime === "object" &&
        assignment.startDateTime.seconds
      ) {
        // 如果是Firestore Timestamp
        assignmentStartObj = new Date(assignment.startDateTime.seconds * 1000);
        assignmentEndObj = new Date(assignment.endDateTime.seconds * 1000);
      } else if (typeof assignment.startDateTime === "number") {
        // 如果是数字时间戳
        assignmentStartObj = new Date(assignment.startDateTime);
        assignmentEndObj = new Date(assignment.endDateTime);
      } else {
        // 如果是ISO字符串
        assignmentStartObj = new Date(assignment.startDateTime);
        assignmentEndObj = new Date(assignment.endDateTime);
      }

      // 检查日期是否相同（仅考虑年月日）
      const assignmentDate = new Date(
        assignmentStartObj.getFullYear(),
        assignmentStartObj.getMonth(),
        assignmentStartObj.getDate()
      );

      const requestedDate = new Date(
        bookingDate.getFullYear(),
        bookingDate.getMonth(),
        bookingDate.getDate()
      );

      // 如果日期不同，跳过这条记录
      if (assignmentDate.getTime() !== requestedDate.getTime()) {
        console.log(
          `跳过日期不同的记录: ${assignmentDate.toLocaleDateString()} != ${requestedDate.toLocaleDateString()}`
        );
        return;
      }

      // 检查时间冲突 - 判断两个时间段是否重叠
      const timeOverlap =
        assignmentStartObj < slowRoomEndDateTime &&
        assignmentEndObj > slowRoomStartDateTime;

      console.log(
        `Slow Room时间重叠检查: ${assignmentStartObj.toLocaleTimeString()} - ${assignmentEndObj.toLocaleTimeString()} 与请求时间 ${slowRoomStartDateTime.toLocaleTimeString()} - ${slowRoomEndDateTime.toLocaleTimeString()} 重叠: ${timeOverlap}`
      );

      if (timeOverlap) {
        console.log(
          `Slow Room已被占用: ${
            assignment.physicalRoomId
          }, 重叠时间段: ${Math.max(
            assignmentStartObj.getTime(),
            slowRoomStartDateTime.getTime()
          )} - ${Math.min(
            assignmentEndObj.getTime(),
            slowRoomEndDateTime.getTime()
          )}`
        );
        occupiedRooms.add(assignment.physicalRoomId);
      }
    });

    // 创建可用Slow Room映射
    const availableRooms: { [key: string]: boolean } = {};

    // 添加所有Slow Room的可用状态
    slowRoomIds.forEach((roomId) => {
      availableRooms[roomId] = !occupiedRooms.has(roomId);
    });

    console.log("可用Slow Room:", availableRooms);

    return NextResponse.json({ availableRooms });
  } catch (error) {
    console.error("Error checking slow room availability:", error);
    return NextResponse.json(
      { error: "スロールームの空き状況の確認に失敗しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
