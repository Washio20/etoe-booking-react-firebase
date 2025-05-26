// src\app\api\pure-slow-room-availability\route.ts
// 检查特定时间段的可用性

import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { parseISO, format } from "date-fns";
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
    const startTimeStr = searchParams.get("startTime");
    const endTimeStr = searchParams.get("endTime");

    // 参数验证
    if (!dateStr) {
      return NextResponse.json(
        { error: "日付は必須項目です" },
        { status: 400 }
      );
    }

    if (!startTimeStr || !endTimeStr) {
      return NextResponse.json(
        { error: "開始時間と終了時間は必須項目です" },
        { status: 400 }
      );
    }

    // 解析日期和时间
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
          isAvailable: false,
          message: "予約可能な日付は本日から3週間以内です。別の日付を選択してください。"
        },
        { status: 400 }
      );
    }

    // 标准化时间格式
    const normalizeTimeStr = (timeStr: string) => {
      const match = timeStr.match(/(\d+):(\d+)/);
      if (match) {
        return `${String(match[1]).padStart(2, "0")}:${String(
          match[2]
        ).padStart(2, "0")}`;
      }
      return timeStr;
    };

    const normalizedStartTime = normalizeTimeStr(startTimeStr);
    const normalizedEndTime = normalizeTimeStr(endTimeStr);
    
    const [startHour, startMinute] = normalizedStartTime.split(":").map(Number);
    const [endHour, endMinute] = normalizedEndTime.split(":").map(Number);

    // 检查结束时间是否超过23:40
    if (endHour > 23 || (endHour === 23 && endMinute > 40)) {
      return NextResponse.json(
        { 
          error: "終了時間は23:40までです",
          isAvailable: false,
          message: "終了時間は23:40までです。別の時間を選択してください。"
        },
        { status: 400 }
      );
    }
    
    // 格式化为YYYY-MM-DD，用于查询dailyInventory
    const formattedDate = format(date, "yyyy-MM-dd");

    // console.log(
    //   `请求参数: date=${dateStr}(${formattedDate}), startTime=${normalizedStartTime}, endTime=${normalizedEndTime}`
    // );

    // 创建请求的时间范围
    const startDateTime = new Date(date);
    startDateTime.setHours(startHour, startMinute, 0, 0);

    const endDateTime = new Date(date);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    // console.log(
    //   `请求时间范围: ${startDateTime.toISOString()} 到 ${endDateTime.toISOString()}`
    // );

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
    const startDateTimeTimestamp =
      admin.firestore.Timestamp.fromDate(startDateTime);
    const endDateTimeTimestamp =
      admin.firestore.Timestamp.fromDate(endDateTime);

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

    // 提取时间重叠的预约
    type ReservationDoc =
      admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>;
    type OverlappingReservation = {
      id: string;
      startDateTime: Date;
      endDateTime: Date;
      isSetPlan: boolean;
      [key: string]: any;
    };

    const extractOverlappingReservations = (
      snapshot: admin.firestore.QuerySnapshot<admin.firestore.DocumentData>,
      startDateTime: Date,
      endDateTime: Date,
      isSetPlan: boolean = false
    ): OverlappingReservation[] => {
      const overlappingReservations: OverlappingReservation[] = [];

      snapshot.forEach((doc: ReservationDoc) => {
        const reservation = doc.data();

        let reservationStartTime: Date | null = null;
        let reservationEndTime: Date | null = null;

        // 优先使用新字段结构
        if (isSetPlan) {
          // 作为套餐的slow room预约
          if (
            reservation.slowRoomStartDateTime &&
            reservation.slowRoomEndDateTime
          ) {
            reservationStartTime = reservation.slowRoomStartDateTime.toDate();
            reservationEndTime = reservation.slowRoomEndDateTime.toDate();
          }
        } else {
          // 普通slow room预约
          if (reservation.startDateTime && reservation.endDateTime) {
            reservationStartTime = reservation.startDateTime.toDate();
            reservationEndTime = reservation.endDateTime.toDate();
          }
        }

        // 如果未能从新字段获取时间，尝试从旧字段解析（向后兼容）
        if (!reservationStartTime || !reservationEndTime) {
          try {
            if (isSetPlan) {
              // 尝试从旧字段获取时间
              const startTimeString = reservation.slowRoomStartTime;
              const endTimeString = reservation.slowRoomEndTime;

              // 如果直接有时间字符串
              if (startTimeString && endTimeString) {
                reservationStartTime = parseTimeString(date, startTimeString);
                reservationEndTime = parseTimeString(date, endTimeString);
              }
              // 尝试从slowRoomTime字段解析
              else if (reservation.slowRoomTime) {
                const timeStr = reservation.slowRoomTime;
                const timeParts = timeStr.split(/[〜～~\-]/);
                if (timeParts.length === 2) {
                  reservationStartTime = parseTimeString(
                    date,
                    timeParts[0].trim()
                  );
                  reservationEndTime = parseTimeString(
                    date,
                    timeParts[1].trim()
                  );
                }
              }
            } else {
              // 尝试从普通预约的旧字段获取时间
              const startTimeString = reservation.startTime || "";
              const endTimeString = reservation.endTime || "";

              // 如果直接有时间字符串
              if (startTimeString && endTimeString) {
                reservationStartTime = parseTimeString(date, startTimeString);
                reservationEndTime = parseTimeString(date, endTimeString);
              }
              // 尝试从reservationTime字段解析
              else if (reservation.reservationTime) {
                const timeStr = reservation.reservationTime;
                const timeParts = timeStr.split(/[〜～~\-]/);
                if (timeParts.length === 2) {
                  reservationStartTime = parseTimeString(
                    date,
                    timeParts[0].trim()
                  );
                  reservationEndTime = parseTimeString(
                    date,
                    timeParts[1].trim()
                  );
                }
              }
            }
          } catch (error) {
            console.error("解析旧时间字段时出错:", error);
          }
        }

        // 如果仍然无法获取时间，跳过此预约
        if (!reservationStartTime || !reservationEndTime) {
          console.log(`预约 ${doc.id} 无法获取有效的时间信息，跳过`);
          return;
        }

        // 检查时间是否重叠 - 即使有1分钟的重叠也算冲突
        const hasOverlap =
          reservationStartTime < endDateTime &&
          reservationEndTime > startDateTime;

        if (hasOverlap) {
          console.log(
            `发现重叠预约 ${
              doc.id
            }: ${reservationStartTime.toLocaleTimeString()} - ${reservationEndTime.toLocaleTimeString()}`
          );
          overlappingReservations.push({
            id: doc.id,
            ...reservation,
            startDateTime: reservationStartTime,
            endDateTime: reservationEndTime,
            isSetPlan,
          });
        }
      });

      return overlappingReservations;
    };

    // 提取与请求时间重叠的预约
    const overlappingSlowRoomReservations = extractOverlappingReservations(
      slowRoomReservationsSnapshot,
      startDateTime,
      endDateTime,
      false
    );

    const overlappingSetplanReservations = extractOverlappingReservations(
      setplanReservationsSnapshot,
      startDateTime,
      endDateTime,
      true
    );

    // 合并所有重叠的预约
    const allOverlappingReservations = [
      ...overlappingSlowRoomReservations,
      ...overlappingSetplanReservations,
    ];

    console.log(`总共有 ${allOverlappingReservations.length} 个重叠的预约`);

    // 获取slow room配置，包括dailyInventory
    let maxReservationsFromConfig = totalSlowRooms;
    let maxReservationsFromDailyInventory = totalSlowRooms;

    if (!slowRoomSnapshot.empty) {
      const slowRoomData = slowRoomSnapshot.docs[0].data();
      console.log("处理slow room配置数据");

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
      } else {
        console.log(
          `在dailyInventory中未找到 ${formattedDate} 的设置，使用默认值: ${maxReservationsFromDailyInventory}`
        );
      }

      // 2. 检查房间全局设置
      if (slowRoomData.maxReservations) {
        maxReservationsFromConfig = slowRoomData.maxReservations;
        console.log(
          `从房间配置读取maxReservations: ${maxReservationsFromConfig}`
        );
      }
    } else {
      console.log(`未找到slow room配置，使用默认总房间数: ${totalSlowRooms}`);
    }

    // 使用dailyInventory和配置中的限制（取较小值）作为最终最大预约数
    const finalMaxReservations = Math.min(
      maxReservationsFromConfig,
      maxReservationsFromDailyInventory
    );
    console.log(
      `最终使用的最大预约数: ${finalMaxReservations}（配置:${maxReservationsFromConfig}, 日期限制:${maxReservationsFromDailyInventory}）`
    );

    // 计算可用房间数：最大预约数 - 重叠的预约数
    const availableRooms =
      finalMaxReservations - allOverlappingReservations.length;
    console.log(
      `最大预约数: ${finalMaxReservations}, 重叠预约数: ${allOverlappingReservations.length}, 可用房间数: ${availableRooms}`
    );

    // 判断是否有可用房间
    if (availableRooms <= 0) {
      return NextResponse.json({
        isAvailable: false,
        message:
          "選択した時間帯のSlow Roomは満室です。別の時間帯を選択してください。",
        overlappingCount: allOverlappingReservations.length,
        maxReservations: finalMaxReservations,
      });
    }

    // 添加服务器时间信息
    const serverNow = new Date();

    // 返回结果
    return NextResponse.json({
      isAvailable: true,
      availableRooms: Math.max(0, availableRooms),
      overlappingCount: allOverlappingReservations.length,
      maxReservations: finalMaxReservations,
    });
  } catch (error) {
    console.error("检查slow room可用性失败:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
