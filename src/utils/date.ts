import { FirestoreTimestamp } from "@/types/reservation";

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
