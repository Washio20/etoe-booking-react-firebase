// sauna房间可用性查询API
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/utils/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { Room, TimeSlotDefinition } from "@/types/room";

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";

// 房间名称映射
const ROOM_NAMES: Record<string, string> = {
  tototo: "TOTOTO",
  fuuu: "FUUU",
  zabuun: "ZABUUN",
  toron: "TORON",
  sauna_suite: "サウナスイート",
};

// 星期名称
const DAYS_OF_WEEK = ["日", "月", "火", "水", "木", "金", "土"];

// 日本的法定假日（2025年部分）
const HOLIDAYS_2025 = [
  "2025-01-01", // 元旦
  "2025-01-13", // 成人の日
  "2025-02-11", // 建国記念日
  "2025-02-23", // 天皇誕生日
  "2025-02-24", // 振替休日
  "2025-03-21", // 春分の日
  "2025-04-29", // 昭和の日
  "2025-05-03", // 憲法記念日
  "2025-05-04", // みどりの日
  "2025-05-05", // こどもの日
  "2025-05-06", // 振替休日
  "2025-07-21", // 海の日
  "2025-08-11", // 山の日
  "2025-09-15", // 敬老の日
  "2025-09-23", // 秋分の日
  "2025-10-13", // スポーツの日
  "2025-11-03", // 文化の日
  "2025-11-23", // 勤労感謝の日
  "2025-11-24", // 振替休日
];

interface EnhancedReservation {
  [key: string]: any;
  parsedDate?: Date;
  parsedTimeSlot?: string;
}

// 检查是否为周末
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0是周日，6是周六
}

// 检查是否为假日
function isHoliday(dateStr: string): boolean {
  return HOLIDAYS_2025.includes(dateStr);
}

// 格式化日期为YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// 从预约记录判断时间段状态
function determineTimeSlotStatus(
  availablePlaces: number,
  maxReservations: number
): "○" | "×" {
  // 如果没有可用位置，返回"×"
  if (availablePlaces <= 0) {
    return "×";
  }

  // 只要有位置可用，就返回"○"
  return "○";
}

// 获取房间配置信息，包括时间段
async function getRoomConfig(roomType: string): Promise<Room | null> {
  try {
    // 查询rooms集合中匹配roomType的记录
    const roomsQuery = query(
      collection(db, "rooms"),
      where("roomType", "==", roomType)
    );

    const roomsSnapshot = await getDocs(roomsQuery);

    if (roomsSnapshot.empty) {
      console.log(`没有找到roomType为${roomType}的房间配置`);
      return null;
    }

    // 返回第一个匹配的记录
    const roomData = roomsSnapshot.docs[0].data() as Room;
    return {
      ...roomData,
      id: roomsSnapshot.docs[0].id,
    };
  } catch (error) {
    console.error(`获取房间配置失败: ${error}`);
    return null;
  }
}

// 根据房间类型和日期条件获取价格
function getRoomTimeSlotPrice(
  roomConfig: Room | null,
  timeSlot: TimeSlotDefinition | string,
  isWeekendOrHoliday: boolean
): number {
  // 获取时间段对象
  const timeSlotObj =
    typeof timeSlot === "string" ? { time: timeSlot } : timeSlot;
  const timeString = typeof timeSlot === "string" ? timeSlot : timeSlot.time;

  // 检查时间段自身是否有pricing配置
  if (typeof timeSlotObj === "object" && timeSlotObj.pricing) {
    // 根据是否为周末/假日选择对应价格
    if (isWeekendOrHoliday && timeSlotObj.pricing.weekend !== undefined) {
      return timeSlotObj.pricing.weekend;
    } else if (
      !isWeekendOrHoliday &&
      timeSlotObj.pricing.weekday !== undefined
    ) {
      return timeSlotObj.pricing.weekday;
    }

    // 如果没有明确的平日/周末价格配置，尝试其他可能的价格配置
    if (timeSlotObj.pricing.weekday !== undefined) {
      return timeSlotObj.pricing.weekday;
    } else if (timeSlotObj.pricing.weekend !== undefined) {
      return timeSlotObj.pricing.weekend;
    }
  }

  // 如果当前时间段没有价格配置，检查房间的默认时间段配置
  if (roomConfig && roomConfig.timeSlots) {
    // 在房间配置中查找与当前时间匹配的时间段
    const matchingSlot = roomConfig.timeSlots.find((slot) => {
      const slotTime = typeof slot === "string" ? slot : slot.time;
      return slotTime === timeString;
    });

    // 如果找到匹配的时间段且有定价配置
    if (
      matchingSlot &&
      typeof matchingSlot !== "string" &&
      matchingSlot.pricing
    ) {
      if (isWeekendOrHoliday && matchingSlot.pricing.weekend !== undefined) {
        return matchingSlot.pricing.weekend;
      } else if (
        !isWeekendOrHoliday &&
        matchingSlot.pricing.weekday !== undefined
      ) {
        return matchingSlot.pricing.weekday;
      }

      // 尝试使用任何可用的价格配置
      if (matchingSlot.pricing.weekday !== undefined) {
        return matchingSlot.pricing.weekday;
      } else if (matchingSlot.pricing.weekend !== undefined) {
        return matchingSlot.pricing.weekend;
      }
    }
  }

  // 默认价格
  return isWeekendOrHoliday ? 12000 : 10000;
}

// 解析日期时间并转换为指定格式
function formatDateToJapanese(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

// 从一个时间范围字符串解析开始和结束时间
function parseTimeRange(
  timeRange: string
): { start: string; end: string } | null {
  // 支持多种分隔符: 〜 (全角波浪号), ～ (另一种全角波浪号), ~ (半角波浪号), - (连字符)
  const parts = timeRange.split(/[～〜~\-]/);
  if (parts.length !== 2) return null;

  const start = parts[0].trim();
  const end = parts[1].trim();
  
  // 确保时间格式正确（HH:MM）
  const timeRegex = /^([0-9]{1,2}):([0-9]{1,2})$/;
  
  if (!timeRegex.test(start) || !timeRegex.test(end)) {
    return null;
  }
  
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const roomType = searchParams.get("roomType");
    const startDateStr = searchParams.get("startDate");
    const durationStr = searchParams.get("duration");

    // 参数验证
    if (!roomType) {
      return NextResponse.json({ error: "房间类型是必须的" }, { status: 400 });
    }

    if (!startDateStr) {
      return NextResponse.json({ error: "开始日期是必须的" }, { status: 400 });
    }

    // 解析参数
    const startDate = new Date(startDateStr);
    const duration = durationStr ? parseInt(durationStr) : 7; // 默认7天

    // 获取今天的日期（不包含时间）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 计算最大允许日期（今天起3周）
    const maxAllowedDate = new Date(today);
    maxAllowedDate.setDate(today.getDate() + 21); // 3周 = 21天

    // 确保开始日期不早于今天
    if (startDate < today) {
      startDate.setTime(today.getTime());
    }

    // 确保我们不会超出最大允许日期
    let validDuration = duration;

    // 计算从开始日期到最大允许日期的天数
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + validDuration - 1);

    // 如果结束日期超过了最大允许日期，则调整结束日期
    if (endDate > maxAllowedDate) {
      // 以最大允许日期为基准，重新计算持续时间
      const millisDiff = maxAllowedDate.getTime() - startDate.getTime();
      const daysDiff = Math.floor(millisDiff / (1000 * 60 * 60 * 24)) + 1;
      validDuration = Math.max(daysDiff, 0);
    }

    // 如果有效持续时间为0，则没有可用的日期范围，返回空数据
    if (validDuration <= 0) {
      return NextResponse.json({
        roomId: roomType,
        roomName: ROOM_NAMES[roomType] || roomType,
        startDate: formatDate(today),
        endDate: formatDate(today),
        timeSlots: {},
      });
    }

    // 更新结束日期
    endDate.setTime(startDate.getTime());
    endDate.setDate(startDate.getDate() + validDuration - 1);

    // 获取房间配置（包括时间段信息）
    const roomConfig = await getRoomConfig(roomType);

    // 获取房间的预约数据
    const reservationsCollectionRef = collection(db, "reservations");

    // 使用新的日期字段 - bookingDate, 需要创建Timestamp对象用于查询
    const startOfStartDate = new Date(startDate);
    startOfStartDate.setHours(0, 0, 0, 0);
    const startBookingDate = Timestamp.fromDate(startOfStartDate);

    const endOfEndDate = new Date(endDate);
    endOfEndDate.setHours(23, 59, 59, 999);
    const endBookingDate = Timestamp.fromDate(endOfEndDate);

    // 查询此房间类型在指定日期范围内的所有预约 - 使用新的字段结构
    const reservationQuery = query(
      reservationsCollectionRef,
      where("roomType", "==", roomType),
      where("paymentStatus", "==", "paid"),
      where("bookingDate", ">=", startBookingDate),
      where("bookingDate", "<=", endBookingDate)
    );

    const reservationSnapshot = await getDocs(reservationQuery);

    // 存储所有预约记录以用于可用性计算
    // 转换成Map以便快速查找（按日期分组）
    const reservationsByDate: Record<string, any[]> = {};

    reservationSnapshot.docs.forEach((doc) => {
      const data = doc.data();

      // 尝试获取日期 - 优先使用新结构
      let resDate: Date | null = null;

      // 方法1: 使用bookingDate (Timestamp)
      if (data.bookingDate && data.bookingDate instanceof Timestamp) {
        resDate = data.bookingDate.toDate();
      }
      // 方法2: 解析displayDate (字符串, 格式: "YYYY年MM月DD日")
      else if (data.displayDate) {
        try {
          const match = data.displayDate.match(/(\d+)年(\d+)月(\d+)日/);
          if (match) {
            const [_, year, month, day] = match;
            resDate = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day)
            );
          }
        } catch (e) {
          console.error("解析displayDate失败:", e);
        }
      }

      // 如果成功获取了日期，将预约添加到对应日期下
      if (resDate) {
        const formattedDateStr = formatDateToJapanese(resDate);

        if (!reservationsByDate[formattedDateStr]) {
          reservationsByDate[formattedDateStr] = [];
        }

        // 增强预约对象，添加解析出的时间信息
        const enhancedData: EnhancedReservation = {
          ...data,
          parsedDate: resDate,
        };

        // 解析时间信息
        let timeSlot = "";

        // 方法1: 使用startDateTime和endDateTime (新字段)
        if (data.startDateTime && data.endDateTime) {
          const startTime = data.startDateTime.toDate();
          const endTime = data.endDateTime.toDate();

          // 格式化为HH:MM
          const startTimeStr = `${String(startTime.getHours()).padStart(
            2,
            "0"
          )}:${String(startTime.getMinutes()).padStart(2, "0")}`;
          const endTimeStr = `${String(endTime.getHours()).padStart(
            2,
            "0"
          )}:${String(endTime.getMinutes()).padStart(2, "0")}`;

          timeSlot = `${startTimeStr}〜${endTimeStr}`;
        }
        // 方法2: 使用displayTimeRange (新字段)
        else if (data.displayTimeRange) {
          timeSlot = data.displayTimeRange;
        }
        // 方法3: 使用reservationTime (旧字段)
        else if (data.reservationTime) {
          timeSlot = data.reservationTime;
        }

        // 如果成功解析了时间段，添加到增强数据中
        if (timeSlot) {
          enhancedData.parsedTimeSlot = timeSlot;
        }

        reservationsByDate[formattedDateStr].push(enhancedData);
      }
    });

    // 构建时间段数据
    const timeSlots: Record<string, any> = {};

    // 获取当前时间，用于检查时间槽是否过期
    const now = new Date();

    // 为每一天生成时间段
    for (let i = 0; i < validDuration; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      // 确保只返回今天及之后的日期
      if (currentDate < today) {
        continue;
      }

      const dateStr = formatDate(currentDate);
      const dayOfWeek = DAYS_OF_WEEK[currentDate.getDay()];
      const isWeekendOrHoliday = isWeekend(currentDate) || isHoliday(dateStr);

      // 格式化成与数据库中相同格式的日期字符串（"YYYY年MM月DD日"）
      const formattedDateStr = formatDateToJapanese(currentDate);

      // 当天的所有预约
      const dayReservations = reservationsByDate[formattedDateStr] || [];

      // 获取该房间类型的时间段配置
      let timeSlotDefinitions = roomConfig?.timeSlots || [];

      // 如果房间配置中没有时间段定义，使用默认的时间段
      if (timeSlotDefinitions.length === 0) {
        // 默认时间段配置
        timeSlotDefinitions = getDefaultTimeSlots(roomType);
      }

      // 检查是否为当天，用于过期时间检查
      const isToday = 
        currentDate.getDate() === now.getDate() &&
        currentDate.getMonth() === now.getMonth() &&
        currentDate.getFullYear() === now.getFullYear();

      // 构建当天的时间段
      const daySlots = timeSlotDefinitions.map((timeSlot) => {
        const slotTime =
          typeof timeSlot === "string" ? timeSlot : timeSlot.time;

        // 该时间段的所有预约 - 使用解析出的时间段进行匹配
        const slotReservations = dayReservations.filter((res) => {
          // 如果有解析出的时间段，直接比较
          if (res.parsedTimeSlot) {
            return res.parsedTimeSlot === slotTime;
          }

          // 然后检查新字段 displayTimeRange
          if (res.displayTimeRange) {
            return res.displayTimeRange === slotTime;
          }

          // 如果以上都不存在，检查开始和结束时间是否可以组合成匹配的时间段
          // 但仅在两者都存在的情况下
          if (res.startDateTime && res.endDateTime) {
            try {
              const startTime = res.startDateTime.toDate();
              const endTime = res.endDateTime.toDate();

              // 格式化为HH:MM
              const startTimeStr = `${String(startTime.getHours()).padStart(
                2,
                "0"
              )}:${String(startTime.getMinutes()).padStart(2, "0")}`;
              const endTimeStr = `${String(endTime.getHours()).padStart(
                2,
                "0"
              )}:${String(endTime.getMinutes()).padStart(2, "0")}`;

              // 使用时间分隔符检查
              return (
                `${startTimeStr}〜${endTimeStr}` === slotTime ||
                `${startTimeStr}～${endTimeStr}` === slotTime
              );
            } catch (e) {
              console.error("解析时间失败:", e);
              return false;
            }
          }

          // 如果什么都没有，则不匹配
          return false;
        });

        // 计算该时间段的可用位置数
        const maxReservations =
          typeof timeSlot === "object" && timeSlot.maxReservations
            ? timeSlot.maxReservations
            : 1; // 默认最多1个预约

        const availablePlaces = Math.max(
          0,
          maxReservations - slotReservations.length
        );

        // 判断时间段状态
        let status = determineTimeSlotStatus(
          availablePlaces,
          maxReservations
        );
        
        // 如果是当天，检查时间段是否已过期
        if (isToday && status === "○") {
          // 解析时间段，获取开始时间
          const timeRange = parseTimeRange(slotTime);
          if (timeRange) {
            // 解析开始时间 (例如 "10:50")
            const [hours, minutes] = timeRange.start.split(":").map(Number);
            
            // 创建时间槽开始时间的日期对象
            const slotStartTime = new Date(currentDate);
            
            // 处理跨日期的时间段（如"00:20〜01:50"）
            // 如果小时数小于6，认为是次日凌晨
            if (hours < 6) {
              // 将日期加1天
              slotStartTime.setDate(slotStartTime.getDate() + 1);
            }
            
            slotStartTime.setHours(hours, minutes, 0, 0);
            
            // 如果时间槽开始时间早于当前时间，则将状态设置为不可用
            if (slotStartTime < now) {
              status = "×";
            }
          }
        }

        // 计算价格
        const price = getRoomTimeSlotPrice(
          roomConfig,
          timeSlot,
          isWeekendOrHoliday
        );

        return {
          time: slotTime,
          status,
          price,
        };
      });

      // 设置当天的数据
      timeSlots[dateStr] = {
        dayOfWeek,
        isHoliday: isHoliday(dateStr),
        slots: daySlots,
      };
    }

    // 构建响应数据
    const response = {
      roomId: roomType,
      roomName: ROOM_NAMES[roomType] || roomType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      timeSlots,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("获取房间可用性出错:", error);
    return NextResponse.json({ error: "サーバー内部エラー" }, { status: 500 });
  }
}

// 获取默认时间段配置（当数据库中没有配置时使用）
function getDefaultTimeSlots(roomType: string): TimeSlotDefinition[] {
  switch (roomType) {
    case "tototo":
      return [
        { time: "10:50〜12:20", maxReservations: 1 },
        { time: "13:05〜14:35", maxReservations: 1 },
        { time: "15:20〜16:50", maxReservations: 1 },
        { time: "17:35〜19:05", maxReservations: 1 },
        { time: "19:50〜21:20", maxReservations: 1 },
        { time: "22:05〜23:35", maxReservations: 1 },
        // { time: "00:20〜01:50", maxReservations: 1 },
      ];
    case "fuuu":
      return [
        { time: "11:50〜13:20", maxReservations: 1 },
        { time: "13:55〜15:25", maxReservations: 1 },
        { time: "16:00〜17:30", maxReservations: 1 },
        { time: "18:05〜19:35", maxReservations: 1 },
        { time: "20:10〜21:40", maxReservations: 1 },
        { time: "22:15〜24:45", maxReservations: 1 },
        // { time: "00:20〜01:50", maxReservations: 1 },
      ];
    case "zabuun":
      return [
        { time: "10:50〜12:20", maxReservations: 1 },
        { time: "12:55〜14:25", maxReservations: 1 },
        { time: "15:00〜16:30", maxReservations: 1 },
        { time: "17:05〜18:35", maxReservations: 1 },
        { time: "19:10〜20:40", maxReservations: 1 },
        { time: "21:15〜22:45", maxReservations: 1 },
        // { time: "23:20〜00:50", maxReservations: 1 },
      ];
    case "toron":
      return [
        { time: "10:35〜12:05", maxReservations: 1 },
        { time: "12:40〜14:10", maxReservations: 1 },
        { time: "14:45〜16:15", maxReservations: 1 },
        { time: "16:50〜18:20", maxReservations: 1 },
        { time: "18:55〜20:25", maxReservations: 1 },
        { time: "21:00〜22:30", maxReservations: 1 },
        // { time: "23:05〜00:35", maxReservations: 1 },
      ];
    case "sauna_suite":
      return [
        { time: "14:00〜17:00", maxReservations: 1 },
        { time: "18:30〜21:00", maxReservations: 1 },
      ];
    default:
      return [
        { time: "10:00〜12:00", maxReservations: 1 },
        { time: "13:00〜15:00", maxReservations: 1 },
        { time: "16:00〜18:00", maxReservations: 1 },
        { time: "19:00〜21:00", maxReservations: 1 },
      ];
  }
}
