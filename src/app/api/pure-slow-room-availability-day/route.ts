// 纯Slow Room日期可用性查询API
import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { parseISO, format, addMinutes } from "date-fns";
import { initAdmin } from "@/utils/firebase-admin";
import { SLOW_ROOM_MAPPING } from "@/types/room";

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";

// 辅助函数：从时间字符串解析时间
function parseTimeString(date: Date, timeStr: string): Date | null {
  const match = timeStr.match(/(\d+):(\d+)/);
  if (!match) return null;

  const hour = parseInt(match[1]);
  const minute = parseInt(match[2]);

  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

export async function GET(request: NextRequest) {
  try {
    // 初始化Firebase Admin
    initAdmin();
    const db = admin.firestore();

    // 从URL获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const dateStr = searchParams.get("date");

    // 参数验证
    if (!dateStr) {
      return NextResponse.json(
        { error: "日付は必須項目です" },
        { status: 400 }
      );
    }

    // 解析日期
    const date = parseISO(dateStr);
    
    // 检查日期是否在允许范围内（今天到未来3周）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxAllowedDate = new Date();
    maxAllowedDate.setDate(maxAllowedDate.getDate() + 21); // 3周后
    maxAllowedDate.setHours(23, 59, 59, 999);
    
    // 如果日期早于今天或晚于3周后，拒绝请求
    if (date < today || date > maxAllowedDate) {
      return NextResponse.json(
        { 
          error: "予約可能な日付は本日から3週間以内です",
          timeSlots: [],
          date: dateStr,
          maxReservations: 0
        },
        { status: 400 }
      );
    }

    // 格式化为YYYY-MM-DD，用于查询dailyInventory
    const formattedDate = format(date, "yyyy-MM-dd");

    // console.log(`请求参数: date=${dateStr}(${formattedDate})`);

    // 获取所有Slow Room的物理房间ID，用于计算总数
    const slowRoomIds = SLOW_ROOM_MAPPING.slow_room || [];
    const totalSlowRooms = slowRoomIds.length;
    // console.log(`总共有 ${totalSlowRooms} 个Slow Room物理房间`);

    // 创建当天的日期范围用于查询
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 转换为Firestore Timestamp
    const startOfDayTimestamp = admin.firestore.Timestamp.fromDate(startOfDay);
    const endOfDayTimestamp = admin.firestore.Timestamp.fromDate(endOfDay);

    // 查询所有预约记录 - 使用新的字段结构
    // 1. 查询当天的slow room普通预约
    const slowRoomReservationsQuery = db
      .collection("reservations")
      .where("roomType", "==", "slow_room")
      .where("paymentStatus", "==", "paid") // 只查询已支付的预约
      .where("bookingDate", ">=", startOfDayTimestamp)
      .where("bookingDate", "<=", endOfDayTimestamp);

    // 2. 查询当天作为套餐的slow room预约
    const setplanReservationsQuery = db
      .collection("reservations")
      .where("slowRoomAsSetPlan", "==", true)
      .where("paymentStatus", "==", "paid") // 只查询已支付的预约
      .where("bookingDate", ">=", startOfDayTimestamp)
      .where("bookingDate", "<=", endOfDayTimestamp);

    // 3. 获取slow room配置
    const slowRoomQuery = db
      .collection("rooms")
      .where("roomType", "==", "slow_room")
      .limit(1);

    // 执行所有查询
    const [
      slowRoomReservationsSnapshot,
      setplanReservationsSnapshot,
      slowRoomSnapshot,
    ] = await Promise.all([
      slowRoomReservationsQuery.get(),
      setplanReservationsQuery.get(),
      slowRoomQuery.get(),
    ]);

    console.log(
      `查询到 ${slowRoomReservationsSnapshot.size} 个slow room普通预约`
    );
    console.log(
      `查询到 ${setplanReservationsSnapshot.size} 个slow room套餐预约`
    );

    // 提取所有预约的时间段
    type Reservation = {
      startDateTime: Date;
      endDateTime: Date;
      id: string; // 添加ID以便调试
    };

    const extractReservations = (
      snapshot: admin.firestore.QuerySnapshot<admin.firestore.DocumentData>,
      isSetPlan: boolean
    ): Reservation[] => {
      const reservations: Reservation[] = [];

      snapshot.forEach((doc) => {
        const reservation = doc.data();

        let startDateTime: Date | null = null;
        let endDateTime: Date | null = null;

        // 使用新的字段结构
        if (isSetPlan) {
          // 作为套餐的slow room预约
          if (
            reservation.slowRoomStartDateTime &&
            reservation.slowRoomEndDateTime
          ) {
            startDateTime = reservation.slowRoomStartDateTime.toDate();
            endDateTime = reservation.slowRoomEndDateTime.toDate();
          }
        } else {
          // 普通slow room预约
          if (reservation.startDateTime && reservation.endDateTime) {
            startDateTime = reservation.startDateTime.toDate();
            endDateTime = reservation.endDateTime.toDate();
          }
        }

        // 如果未能从新字段获取时间，尝试从旧字段解析（向后兼容）
        if (!startDateTime || !endDateTime) {
          try {
            if (isSetPlan) {
              // 尝试从旧字段获取时间
              const startTimeString = reservation.slowRoomStartTime;
              const endTimeString = reservation.slowRoomEndTime;

              // 如果直接有时间字符串
              if (startTimeString && endTimeString) {
                startDateTime = parseTimeString(date, startTimeString);
                endDateTime = parseTimeString(date, endTimeString);
              }
              // 尝试从slowRoomTime字段解析
              else if (reservation.slowRoomTime) {
                const timeStr = reservation.slowRoomTime;
                const timeParts = timeStr.split(/[〜～~\-]/);
                if (timeParts.length === 2) {
                  startDateTime = parseTimeString(date, timeParts[0].trim());
                  endDateTime = parseTimeString(date, timeParts[1].trim());
                }
              }
            } else {
              // 尝试从普通预约的旧字段获取时间
              const startTimeString = reservation.startTime || "";
              const endTimeString = reservation.endTime || "";

              // 如果直接有时间字符串
              if (startTimeString && endTimeString) {
                startDateTime = parseTimeString(date, startTimeString);
                endDateTime = parseTimeString(date, endTimeString);
              }
              // 尝试从reservationTime字段解析
              else if (reservation.reservationTime) {
                const timeStr = reservation.reservationTime;
                const timeParts = timeStr.split(/[〜～~\-]/);
                if (timeParts.length === 2) {
                  startDateTime = parseTimeString(date, timeParts[0].trim());
                  endDateTime = parseTimeString(date, timeParts[1].trim());
                }
              }
            }
          } catch (error) {
            console.error("解析旧时间字段时出错:", error);
          }
        }

        // 如果仍然无法获取时间，跳过此预约
        if (!startDateTime || !endDateTime) {
          console.log(`预约 ${doc.id} 无法获取有效的时间信息，跳过`);
          return;
        }

        // 记录提取的预约信息用于调试
        console.log(
          `成功提取预约 ${
            doc.id
          }: ${startDateTime.toLocaleTimeString()} 到 ${endDateTime.toLocaleTimeString()}`
        );

        reservations.push({
          startDateTime,
          endDateTime,
          id: doc.id, // 存储ID以便调试
        });
      });

      return reservations;
    };

    const slowRoomReservations = extractReservations(
      slowRoomReservationsSnapshot,
      false
    );
    const setplanReservations = extractReservations(
      setplanReservationsSnapshot,
      true
    );

    // 合并所有预约
    const allReservations = [...slowRoomReservations, ...setplanReservations];
    // console.log(`成功提取 ${allReservations.length} 个预约时间段`);

    // 获取slow room配置，包括dailyInventory
    let maxReservationsFromConfig = totalSlowRooms;
    let maxReservationsFromDailyInventory = totalSlowRooms;
    let timeSlots: any[] = [];

    if (!slowRoomSnapshot.empty) {
      const slowRoomData = slowRoomSnapshot.docs[0].data();

      // 1. 检查dailyInventory中该日期的设置
      if (
        slowRoomData.dailyInventory &&
        typeof slowRoomData.dailyInventory === "object" &&
        formattedDate in slowRoomData.dailyInventory
      ) {
        maxReservationsFromDailyInventory =
          slowRoomData.dailyInventory[formattedDate];
        console.log(
          `从dailyInventory读取 ${formattedDate} 的最大预约数: ${maxReservationsFromDailyInventory}`
        );
      }

      // 2. 获取时间段配置
      if (slowRoomData.timeSlots && Array.isArray(slowRoomData.timeSlots)) {
        timeSlots = slowRoomData.timeSlots;
      }
    }

    // 使用dailyInventory作为全天的最大预约数限制
    const dailyMaxReservations = maxReservationsFromDailyInventory;

    // 生成时间段（每20分钟一个时间段，从9:00到24:00）
    const allTimeSlots = [];
    const startTime = new Date(date);
    startTime.setHours(9, 0, 0, 0);
    const endTime = new Date(date);
    endTime.setHours(23, 40, 0, 0);

    // 步长20分钟
    const stepMinutes = 20;
    // 最小持续时间2小时
    const minDurationMinutes = 120;

    // 遍历生成所有可能的开始时间（截止到最后可开始时间）
    const lastStartTime = new Date(endTime);
    lastStartTime.setMinutes(lastStartTime.getMinutes() - minDurationMinutes);

    let currentTime = new Date(startTime);
    while (currentTime <= lastStartTime) {
      const hour = currentTime.getHours();
      const minute = currentTime.getMinutes();

      // 格式化时间
      const timeStr = `${String(hour).padStart(2, "0")}:${String(
        minute
      ).padStart(2, "0")}`;

      // 生成结束时间（开始时间+2小时）
      const endDateTime = addMinutes(currentTime, minDurationMinutes);
      const endHour = endDateTime.getHours();
      const endMinute = endDateTime.getMinutes();
      const endTimeStr = `${String(endHour).padStart(2, "0")}:${String(
        endMinute
      ).padStart(2, "0")}`;

      // 检查该时间段有多少个重叠的预约
      const overlappingReservations = allReservations.filter((reservation) => {
        // 检查是否有任何时间重叠
        return (
          reservation.startDateTime < endDateTime &&
          reservation.endDateTime > currentTime
        );
      });

      const overlappingCount = overlappingReservations.length;

      // 记录重叠的预约IDs用于调试
      // if (overlappingCount > 0) {
      //   const overlappingIds = overlappingReservations
      //     .map((r) => r.id)
      //     .join(", ");
      //   console.log(
      //     `时间段 ${timeStr}~${endTimeStr} 有 ${overlappingCount} 个重叠预约: ${overlappingIds}`
      //   );
      // }

      // 判断是否可用
      const isAvailable = overlappingCount < dailyMaxReservations;
      const availableCount = Math.max(
        0,
        dailyMaxReservations - overlappingCount
      );

      // 添加到结果中
      allTimeSlots.push({
        startTime: timeStr,
        endTime: endTimeStr,
        timeSlot: `${timeStr}〜${endTimeStr}`,
        overlappingReservations: overlappingCount,
        maxReservations: dailyMaxReservations,
        isAvailable,
        availableCount,
      });

      // 增加20分钟
      currentTime = addMinutes(currentTime, stepMinutes);
    }

    // 修复：特别确保10:00时间槽正确处理，这是一个常见问题点
    const slot1000 = allTimeSlots.find((slot) => slot.startTime === "10:00");
    if (slot1000) {
      // console.log("10:00时间槽数据:", slot1000);
      // 确保如果有可用席位，isAvailable必须为true
      if (slot1000.availableCount > 0 && !slot1000.isAvailable) {
        // console.log("修正10:00时间槽可用状态");
        slot1000.isAvailable = true;
      }
    }

    // 处理当天的时间槽
    const now = new Date();
    const isToday = dateStr === now.toISOString().split("T")[0];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // 如果是当天，过滤掉已经过去的时间段
    if (isToday) {
      allTimeSlots.forEach((slot) => {
        const [slotHour, slotMinute] = slot.startTime.split(":").map(Number);

        // 修改时间判断逻辑：
        // 1. 如果当前时间小于10点，保持原有逻辑
        // 2. 如果当前时间大于等于10点，只禁用已经过去的上午时段
        if (currentHour < 10) {
          // 原有逻辑：如果时间槽已经过去（考虑预留30分钟的缓冲时间）
          if (
            slotHour < currentHour ||
            (slotHour === currentHour && slotMinute < currentMinute + 30)
          ) {
            slot.isAvailable = false;
          }
        } else {
          // 新逻辑：如果当前时间已经过了10点，只禁用上午的时段
          if (slotHour < 12) {
            slot.isAvailable = false;
          }
        }
      });
    }

    return NextResponse.json({
      date: formattedDate,
      maxReservations: dailyMaxReservations,
      timeSlots: allTimeSlots,
    });
  } catch (error) {
    console.error("获取时间槽可用性失败:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
