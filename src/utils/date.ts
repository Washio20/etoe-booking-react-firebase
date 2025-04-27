import { FirestoreTimestamp } from "@/types/reservation";
import { format } from "date-fns";
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
