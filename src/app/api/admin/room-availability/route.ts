import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import {
  SAUNA_ROOM_MAPPING,
  SUITE_ROOM_MAPPING,
  SLOW_ROOM_MAPPING,
} from "@/types/room";

// 确保Firebase Admin已初始化
initAdmin();

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";

export async function GET(req: Request) {
  try {
    console.log("开始处理房间可用性检查请求");

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
    console.log(`正在获取预约ID: ${reservationId} 的信息`);
    const reservationDoc = await db
      .collection("reservations")
      .doc(reservationId)
      .get();

    if (!reservationDoc.exists) {
      console.error(`预约ID: ${reservationId} 不存在`);
      return NextResponse.json(
        { error: "予約が見つかりません" },
        { status: 404 }
      );
    }

    const reservation = reservationDoc.data();

    if (!reservation) {
      console.error("预约数据为空");
      return NextResponse.json(
        { error: "予約データが無効です" },
        { status: 400 }
      );
    }

    // 解析预约时间和日期以检查可用性
    const { roomType } = reservation;

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
        console.error("缺少必要的预约日期数据");
        return NextResponse.json(
          { error: "予約データが不完全です" },
          { status: 400 }
        );
      }

      console.log(
        "处理旧式预约日期:",
        reservationDate,
        "类型:",
        typeof reservationDate
      );

      try {
        if (typeof reservationDate === "string") {
          // 1. 尝试解析 YYYY年MM月DD日 格式
          const match = reservationDate.match(/(\d+)年(\d+)月(\d+)日/);
          if (match) {
            const [_, year, month, day] = match;
            bookingDate = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day)
            );
          }
          // 2. 尝试解析 YYYY-MM-DD 格式
          else if (reservationDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            bookingDate = new Date(reservationDate);
          }
          // 3. 尝试直接解析任何可以被Date构造函数识别的格式
          else {
            bookingDate = new Date(reservationDate);
          }
        }
        // 4. 处理 Firestore Timestamp 对象
        else if (
          typeof reservationDate === "object" &&
          "seconds" in reservationDate
        ) {
          bookingDate = new Date(reservationDate.seconds * 1000);
        }
        // 5. 其他未知格式
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

    console.log("最终解析的预约日期:", bookingDate.toISOString());

    if (!roomType) {
      console.error("缺少房间类型");
      return NextResponse.json(
        { error: "部屋タイプが不明です" },
        { status: 400 }
      );
    }

    // 创建开始和结束的日期时间对象
    let startDateTime = new Date(bookingDate);
    let endDateTime = new Date(bookingDate);

    // 处理预约时间 - 支持新的字段结构和旧的字段结构
    // 区分slow_room和其他房间类型的处理
    if (roomType === "slow_room") {
      console.log("处理slow_room类型的预约");

      // 1. 优先使用新的字段结构（startDateTime和endDateTime）
      if (reservation.startDateTime && reservation.endDateTime) {
        try {
          startDateTime =
            typeof reservation.startDateTime === "object" &&
            "seconds" in reservation.startDateTime
              ? new Date(reservation.startDateTime.seconds * 1000)
              : new Date(reservation.startDateTime);

          endDateTime =
            typeof reservation.endDateTime === "object" &&
            "seconds" in reservation.endDateTime
              ? new Date(reservation.endDateTime.seconds * 1000)
              : new Date(reservation.endDateTime);

          console.log("使用startDateTime和endDateTime字段:", {
            startDateTime: startDateTime.toISOString(),
            endDateTime: endDateTime.toISOString(),
          });
        } catch (e) {
          console.error("解析startDateTime/endDateTime失败:", e);
          // 如果解析失败，将继续尝试使用旧字段
        }
      }

      // 2. 如果没有成功设置，尝试使用旧的字段结构
      if (startDateTime.getTime() === endDateTime.getTime()) {
        // 提取slow room预约的开始和结束时间
        let startTime, endTime;

        // a. 检查是否有专门的slowRoom时间字段
        if (reservation.slowRoomStartTime && reservation.slowRoomEndTime) {
          startTime = reservation.slowRoomStartTime;
          endTime = reservation.slowRoomEndTime;
          console.log("使用专门的slowRoom时间字段:", { startTime, endTime });
        }
        // b. 检查是否有合并的slowRoomTime字段 (例如 "14:00〜16:00")
        else if (reservation.slowRoomTime) {
          let timeParts = [];
          if (reservation.slowRoomTime.includes("〜")) {
            timeParts = reservation.slowRoomTime.split("〜");
          } else if (reservation.slowRoomTime.includes("-")) {
            timeParts = reservation.slowRoomTime.split("-");
          }

          if (timeParts.length === 2) {
            [startTime, endTime] = timeParts;
            console.log("从slowRoomTime解析时间:", { startTime, endTime });
          } else {
            // 如果无法分割，使用默认设置
            startTime = "08:00";
            endTime = "22:00";
            console.log("无法从slowRoomTime解析时间，使用默认值:", {
              startTime,
              endTime,
            });
          }
        }
        // c. 尝试使用通用预约时间字段
        else if (reservation.reservationTime) {
          let timeParts = [];
          if (reservation.reservationTime.includes("〜")) {
            timeParts = reservation.reservationTime.split("〜");
          } else if (reservation.reservationTime.includes("-")) {
            timeParts = reservation.reservationTime.split("-");
          }

          if (timeParts.length === 2) {
            [startTime, endTime] = timeParts;
            console.log("从reservationTime解析时间:", { startTime, endTime });
          } else {
            // 如果无法分割，使用默认设置
            startTime = "08:00";
            endTime = "22:00";
            console.log("无法从reservationTime解析时间，使用默认值:", {
              startTime,
              endTime,
            });
          }
        }
        // d. 如果没有时间信息，使用全天时间
        else {
          startTime = "08:00";
          endTime = "22:00";
          console.log("找不到时间信息，使用全天时间:", { startTime, endTime });
        }

        // 清理和解析时间
        startTime = startTime?.trim() || "08:00";
        endTime = endTime?.trim() || "22:00";

        // 解析时间为小时和分钟并设置日期时间
        try {
          const startMatch = startTime.match(/(\d+):(\d+)/);
          const endMatch = endTime.match(/(\d+):(\d+)/);

          if (startMatch) {
            const startHour = parseInt(startMatch[1]);
            const startMinute = parseInt(startMatch[2]);
            startDateTime.setHours(startHour, startMinute, 0, 0);
          } else {
            startDateTime.setHours(8, 0, 0, 0);
          }

          if (endMatch) {
            const endHour = parseInt(endMatch[1]);
            const endMinute = parseInt(endMatch[2]);
            endDateTime.setHours(endHour, endMinute, 0, 0);
          } else {
            endDateTime.setHours(22, 0, 0, 0);
          }
        } catch (e) {
          console.error("解析slow room时间失败:", e);
          // 使用默认值
          startDateTime.setHours(8, 0, 0, 0);
          endDateTime.setHours(22, 0, 0, 0);
        }
      }
    }
    // 非slow_room房间类型的处理
    else {
      // 1. 优先使用新的字段结构（startDateTime和endDateTime）
      if (reservation.startDateTime && reservation.endDateTime) {
        try {
          startDateTime =
            typeof reservation.startDateTime === "object" &&
            "seconds" in reservation.startDateTime
              ? new Date(reservation.startDateTime.seconds * 1000)
              : new Date(reservation.startDateTime);

          endDateTime =
            typeof reservation.endDateTime === "object" &&
            "seconds" in reservation.endDateTime
              ? new Date(reservation.endDateTime.seconds * 1000)
              : new Date(reservation.endDateTime);

          console.log("使用startDateTime和endDateTime字段:", {
            startDateTime: startDateTime.toISOString(),
            endDateTime: endDateTime.toISOString(),
          });
        } catch (e) {
          console.error("解析startDateTime/endDateTime失败:", e);
          // 如果解析失败，将继续尝试使用旧字段
        }
      }

      // 2. 如果没有成功设置，尝试使用旧的字段结构
      if (startDateTime.getTime() === endDateTime.getTime()) {
        console.log("处理非slow_room预约，使用旧字段结构");
        const reservationTime = reservation.reservationTime;

        if (reservationTime) {
          console.log("处理预约时间:", reservationTime);

          let startTime, endTime;

          // 尝试使用分隔符拆分时间
          if (reservationTime.includes("〜")) {
            [startTime, endTime] = reservationTime.split("〜");
          } else if (reservationTime.includes("-")) {
            [startTime, endTime] = reservationTime.split("-");
          } else {
            // 如果没有分隔符，尝试使用其他字段
            startTime = reservation.startTime || reservationTime;
            endTime = reservation.endTime;

            // 如果还是没有结束时间，根据房间类型设置默认持续时间
            if (!endTime && startTime) {
              try {
                const [hourStr, minuteStr] = startTime.split(":");
                let hour = parseInt(hourStr);
                let minute = parseInt(minuteStr);
                let duration = 1.5; // 默认1.5小时

                if (roomType === "sauna_suite") {
                  duration = 3; // 套房3小时
                }

                // 计算结束时间
                let endHour = hour + Math.floor(duration);
                let endMinute = minute + (duration % 1) * 60;

                if (endMinute >= 60) {
                  endHour += 1;
                  endMinute -= 60;
                }

                // 处理跨天的情况
                if (endHour >= 24) {
                  endHour -= 24;
                }

                endTime = `${endHour}:${endMinute}`;
              } catch (e) {
                console.error("计算结束时间失败:", e);
                endTime = "23:00"; // 默认结束时间
              }
            }
          }

          // 清理和解析时间
          startTime = startTime?.trim();
          endTime = endTime?.trim();

          if (!startTime || !endTime) {
            console.error("无法解析预约时间:", {
              reservationTime,
              startTime,
              endTime,
            });
            return NextResponse.json(
              { error: "予約時間の解析に失敗しました" },
              { status: 400 }
            );
          }

          // 解析时间为小时和分钟
          try {
            const startMatch = startTime.match(/(\d+):(\d+)/);
            const endMatch = endTime.match(/(\d+):(\d+)/);

            if (!startMatch || !endMatch) {
              throw new Error("Invalid time format");
            }

            const startHour = parseInt(startMatch[1]);
            const startMinute = parseInt(startMatch[2]);
            const endHour = parseInt(endMatch[1]);
            const endMinute = parseInt(endMatch[2]);

            startDateTime.setHours(startHour, startMinute, 0, 0);
            endDateTime.setHours(endHour, endMinute, 0, 0);
          } catch (e) {
            console.error("解析时间失败:", { startTime, endTime }, e);
            return NextResponse.json(
              { error: "予約時間の形式が無効です" },
              { status: 400 }
            );
          }
        } else {
          // 没有任何时间信息，使用默认值
          console.warn("没有找到时间信息，使用全天时间");
          startDateTime.setHours(8, 0, 0, 0);
          endDateTime.setHours(22, 0, 0, 0);
        }
      }
    }

    console.log("最终预约时间范围:", {
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    });

    // 获取该房间类型对应的所有物理房间
    let allRoomIds: string[] = [];

    // 获取主房间ID
    switch (roomType) {
      case "tototo":
      case "fuuu":
      case "zabuun":
      case "toron":
        allRoomIds = SAUNA_ROOM_MAPPING[roomType] || [];
        break;
      case "sauna_suite":
        allRoomIds = SUITE_ROOM_MAPPING.sauna_suite || [];
        break;
      case "slow_room":
        allRoomIds = SLOW_ROOM_MAPPING.slow_room || [];
        break;
      default:
        console.error("未知的房间类型:", roomType);
        return NextResponse.json(
          { error: "不明な部屋タイプです" },
          { status: 400 }
        );
    }

    console.log(`房间类型 ${roomType} 对应的物理房间IDs:`, allRoomIds);

    // 创建当天的日期范围用于查询
    const dayStart = new Date(bookingDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(bookingDate);
    dayEnd.setHours(23, 59, 59, 999);

    // 转换为Firestore Timestamp
    const dayStartTimestamp = Timestamp.fromDate(dayStart);
    const dayEndTimestamp = Timestamp.fromDate(dayEnd);

    console.log("查询房间分配，日期范围:", {
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
    });

    // 查询活跃的房间分配
    const assignmentsQuery = db
      .collection("roomAssignments")
      .where("status", "==", "active");

    const assignmentsSnapshot = await assignmentsQuery.get();

    console.log(`搜索到 ${assignmentsSnapshot.size} 个房间分配记录`);

    // 找出所有与所请求时间段重叠的房间
    const occupiedRooms = new Set<string>();

    assignmentsSnapshot.forEach((doc) => {
      const assignment = doc.data();

      // 解析分配记录的时间
      let assignmentStartObj: Date, assignmentEndObj: Date;

      try {
        // 处理不同格式的日期时间
        if (
          typeof assignment.startDateTime === "object" &&
          assignment.startDateTime.seconds
        ) {
          // 如果是Firestore Timestamp
          assignmentStartObj = new Date(
            assignment.startDateTime.seconds * 1000
          );
          assignmentEndObj = new Date(assignment.endDateTime.seconds * 1000);
        } else if (typeof assignment.startDateTime === "number") {
          // 如果是数字时间戳
          assignmentStartObj = new Date(assignment.startDateTime);
          assignmentEndObj = new Date(assignment.endDateTime);
        } else {
          // 如果是ISO字符串或其他格式
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
          return;
        }

        // 检查主房间时间冲突
        const mainRoomOverlap =
          assignmentStartObj < endDateTime && assignmentEndObj > startDateTime;

        // 如果有重叠，添加到占用的房间集合中
        if (mainRoomOverlap) {
          occupiedRooms.add(assignment.physicalRoomId);
        }
      } catch (e) {
        console.error("处理房间分配记录时出错:", e, assignment);
      }
    });

    console.log("已占用房间:", Array.from(occupiedRooms));

    // 创建可用房间映射
    const availableRooms: { [key: string]: boolean } = {};

    // 添加所有可能的房间
    allRoomIds.forEach((roomId) => {
      availableRooms[roomId] = !occupiedRooms.has(roomId);
    });

    console.log("可用房间状态:", availableRooms);

    // 检查是否所有房间都被占用
    const hasAvailableRoom = Object.values(availableRooms).some(
      (isAvailable) => isAvailable
    );
    if (!hasAvailableRoom) {
      console.log("没有可用房间");
      return NextResponse.json({
        availableRooms,
        message: "予約時間帯に利用可能な部屋がありません",
      });
    }

    return NextResponse.json({ availableRooms });
  } catch (error) {
    console.error("Error checking room availability:", error);
    return NextResponse.json(
      { error: "部屋の空き状況の確認に失敗しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
