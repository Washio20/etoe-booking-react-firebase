import { FirestoreTimestamp } from "@/types/reservation";
import { format, parse, isValid } from "date-fns";
import { ja } from "date-fns/locale";

// 将任何时间戳类型转换为Date对象
export const toDate = (
  timestamp: FirestoreTimestamp | Date | string | null | undefined
): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "string") return new Date(timestamp);
  if (typeof timestamp === "object" && "toDate" in timestamp)
    return timestamp.toDate();
  return null;
};

// 解析日期字符串（添加到组件外部或工具函数中）
export const parseJapaneseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [_, year, month, day] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    0,
    0,
    0,
    0
  );
};

// 格式化日期为日语格式
export const formatToJapaneseDate = (date: Date): string => {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

export const formatToHtmlDate = (date: Date | null): string => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 任意のタイムスタンプ値をDateオブジェクトに変換する関数
 * @param value FirestoreTimestamp、Date、文字列など
 * @returns タイムスタンプ値から生成されたDateオブジェクト、または変換できない場合はnull
 */
export const convertToDate = (value: any): Date | null => {
  try {
    // nullまたはundefinedの場合
    if (!value) return null;

    // すでにDateオブジェクトの場合
    if (value instanceof Date) return value;

    // Firestoreタイムスタンプ（toDateメソッドがある場合）
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      return value.toDate();
    }

    // secondsとnanosecondsフィールドを持つオブジェクト
    if (typeof value === 'object' && (value.seconds !== undefined || value._seconds !== undefined)) {
      const seconds = value.seconds !== undefined ? value.seconds : value._seconds;
      return new Date(seconds * 1000);
    }

    // 文字列の場合、Dateコンストラクタを使用
    if (typeof value === 'string') {
      const date = new Date(value);
      // 有効な日付かチェック
      return isNaN(date.getTime()) ? null : date;
    }

    // 数値の場合（UNIXタイムスタンプとして扱う）
    if (typeof value === 'number') {
      return new Date(value);
    }

    return null;
  } catch (error) {
    console.error("日付変換エラー:", error, value);
    return null;
  }
};

/**
 * タイムスタンプ値をフォーマットされた日時文字列に変換する関数
 * @param timestamp FirestoreTimestamp、Date、文字列などの日付値
 * @param formatStr 日付フォーマットパターン（date-fnsのformat関数形式）
 * @param defaultValue 変換失敗時のデフォルト値
 * @returns フォーマットされた日時文字列、または変換失敗時にはデフォルト値
 */
export const formatTimestamp = (
  timestamp: any, 
  formatStr: string = "yyyy/MM/dd HH:mm", 
  defaultValue: string = ""
): string => {
  try {
    const date = convertToDate(timestamp);
    if (!date) return defaultValue;
    
    return format(date, formatStr, { locale: ja });
  } catch (error) {
    console.error("日付フォーマットエラー:", error, timestamp);
    return defaultValue;
  }
};

/**
 * タイムスタンプ値をミリ秒（UNIX時間）に変換する関数
 * @param value FirestoreTimestamp、Date、文字列などの日付値
 * @returns ミリ秒単位のUNIX時間、変換失敗時には現在時刻
 */
export const getTimestampMillis = (value: any): number => {
  const date = convertToDate(value);
  return date ? date.getTime() : Date.now();
};

// 统一的时间字符串解析
export const parseTimeString = (
  timeStr: string
): { hour: number; minute: string } | null => {
  if (!timeStr) return null;

  const match = timeStr.match(/(\d+):(\d+)/);
  if (!match) return null;

  return {
    hour: parseInt(match[1]),
    minute: match[2],
  };
};

// 统一处理时间范围分隔符
export const splitTimeRange = (timeRange: string): string[] => {
  return timeRange.split(/[～〜\-~]/);
};

// 创建标准化的时间范围字符串
export const createTimeRangeString = (
  startHour: number,
  startMinute: string,
  endHour: number,
  endMinute: string
): string => {
  return `${String(startHour).padStart(2, "0")}:${startMinute}～${String(
    endHour
  ).padStart(2, "0")}:${endMinute}`;
};

// 比较日期是否是同一天（忽略时间部分）
export const isSameDay = (date1: Date | null, date2: Date | null): boolean => {
  if (!date1 || !date2) return false;
  
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

// 判断日期是否在范围内
export const isDateInRange = (
  date: Date | null,
  startDate: Date | null,
  endDate: Date | null
): boolean => {
  if (!date) return false;
  
  // 只检查开始日期
  if (startDate && !endDate) {
    // 设置为同一天的开始（凌晨）
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return target >= start || isSameDay(target, start);
  }
  
  // 只检查结束日期
  if (!startDate && endDate) {
    // 设置为同一天的结束（23:59:59）
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return target <= end || isSameDay(target, end);
  }
  
  // 检查范围
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const target = new Date(date);
    
    return (
      (target >= start || isSameDay(target, start)) && 
      (target <= end || isSameDay(target, end))
    );
  }
  
  return false;
};

/**
 * 专门用于解析预约系统中的日期字符串
 * 支持多种格式：日语格式（2025年4月13日）、标准格式（2025-04-13）等
 * @param dateStr 日期字符串
 * @returns 日期对象或null
 */
export const parseReservationDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  // 尝试作为日语日期格式解析
  const japaneseMatch = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (japaneseMatch) {
    const [_, year, month, day] = japaneseMatch;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      0, 0, 0, 0
    );
    if (isValid(date)) return date;
  }
  
  // 尝试作为标准格式 YYYY-MM-DD
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    try {
      const date = parse(dateStr, 'yyyy-MM-dd', new Date());
      if (isValid(date)) return date;
    } catch (e) {}
  }
  
  // 尝试作为其他常见格式
  try {
    const date = new Date(dateStr);
    if (isValid(date)) return date;
  } catch (e) {}
  
  return null;
};

/**
 * 用于预约系统的日期格式化函数
 * 将日期对象格式化为日语格式（YYYY年MM月DD日）
 * @param date 日期对象
 * @returns 格式化后的日期字符串
 */
export const formatReservationDateToJapanese = (date: Date | null): string => {
  if (!date || !isValid(date)) return "";
  try {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  } catch (e) {
    console.error("格式化日期出错:", e);
    return "";
  }
};

/**
 * 用于预约系统的HTML日期输入格式化函数
 * 将日期对象格式化为HTML日期输入格式（YYYY-MM-DD）
 * @param date 日期对象
 * @returns 格式化后的日期字符串
 */
export const formatReservationDateToHtml = (date: Date | null): string => {
  if (!date || !isValid(date)) return "";
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("格式化日期出错:", e);
    return "";
  }
};

/**
 * 日语日期字符串转HTML日期格式
 * 直接转换，无需创建Date对象中间步骤
 * @param jaDateStr 日语日期字符串（YYYY年MM月DD日）
 * @returns HTML日期格式字符串（YYYY-MM-DD）
 */
export const japaneseToHtmlDate = (jaDateStr: string): string => {
  if (!jaDateStr) return "";
  const match = jaDateStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (!match) return "";
  
  const [_, year, month, day] = match;
  // 确保月和日是两位数
  const formattedMonth = String(parseInt(month)).padStart(2, '0');
  const formattedDay = String(parseInt(day)).padStart(2, '0');
  
  return `${year}-${formattedMonth}-${formattedDay}`;
};

/**
 * HTML日期格式转日语日期字符串
 * 直接转换，无需创建Date对象中间步骤
 * @param htmlDateStr HTML日期格式字符串（YYYY-MM-DD）
 * @returns 日语日期字符串（YYYY年MM月DD日）
 */
export const htmlToJapaneseDate = (htmlDateStr: string): string => {
  if (!htmlDateStr) return "";
  const parts = htmlDateStr.split('-');
  if (parts.length !== 3) return "";
  
  const [year, month, day] = parts;
  // 移除前导零
  const intMonth = parseInt(month);
  const intDay = parseInt(day);
  
  return `${year}年${intMonth}月${intDay}日`;
};

/**
 * 专门用于预约系统的日期过滤函数
 * 检查预约日期是否在指定范围内，支持多种日期格式
 * @param reservation 预约对象
 * @param searchDate 搜索日期
 * @returns 是否匹配
 */
export const isReservationDateMatch = (
  reservation: any,
  searchDate: Date | string | null
): boolean => {
  if (!searchDate) return true; // 没有搜索日期，默认匹配
  
  // 将搜索日期转换为Date对象
  let searchDateObj: Date | null = null;
  if (typeof searchDate === 'string') {
    // 尝试解析日语格式
    searchDateObj = parseJapaneseDate(searchDate);
    if (!searchDateObj) {
      // 尝试作为标准日期解析
      searchDateObj = new Date(searchDate);
      if (isNaN(searchDateObj.getTime())) {
        return false;
      }
    }
  } else {
    searchDateObj = searchDate;
  }
  
  if (!searchDateObj) return false;
  
  // 设置时间为一天的开始
  searchDateObj.setHours(0, 0, 0, 0);
  
  // 性能优化：创建一个简单的年月日对象，用于比较
  const searchYMD = {
    year: searchDateObj.getFullYear(),
    month: searchDateObj.getMonth(),
    date: searchDateObj.getDate()
  };
  
  // 辅助函数：比较两个日期对象是否为同一天
  const isSameYMD = (date: Date | null): boolean => {
    if (!date) return false;
    return (
      date.getFullYear() === searchYMD.year &&
      date.getMonth() === searchYMD.month &&
      date.getDate() === searchYMD.date
    );
  };
  
  // 首先检查bookingDate字段
  if (reservation.bookingDate) {
    const bookingDate = convertToDate(reservation.bookingDate);
    if (bookingDate && isSameYMD(bookingDate)) {
      return true;
    }
  }
  
  // 然后检查displayDate或reservationDate字段
  const dateStr = reservation.displayDate || reservation.reservationDate;
  if (dateStr) {
    const resDate = parseJapaneseDate(dateStr);
    if (resDate && isSameYMD(resDate)) {
      return true;
    }
  }
  
  // 最后检查预约起止时间是否包含搜索日期
  if (reservation.startDate && reservation.endDate) {
    const startDate = convertToDate(reservation.startDate);
    const endDate = convertToDate(reservation.endDate);
    
    if (startDate && endDate) {
      // 设置为日期的起始和结束
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      // 判断搜索日期是否在预约范围内
      if (searchDateObj >= startDate && searchDateObj <= endDate) {
        return true;
      }
    }
  }
  
  return false;
};
