import { FirestoreTimestamp } from "./reservation";

// 退房状态枚举
export enum CheckoutStatus {
  CHECKED_OUT = "checked_out", // 已退房
  CLEANED = "cleaned", // 已清扫
  READY = "ready" // 准备就绪（可入住）
}

export type StayRating = "not_great" | "good" | "excellent";

// 退房记录接口
export interface CheckoutRecord {
  id: string;
  roomId: string; // 房间号（如：101, 102, 201等）
  checkedOutAt: FirestoreTimestamp | Date | string; // 退房时间
  status: CheckoutStatus; // 退房状态
  createdAt: FirestoreTimestamp | Date | string; // 记录创建时间
  updatedAt?: FirestoreTimestamp | Date | string; // 更新时间
  stayRating?: StayRating; // 住宿评价（可选）
  guestNote?: string; // 客人备注（可选）
  staffNote?: string; // 工作人员备注（可选）
  feedbackSubmittedAt?: FirestoreTimestamp | Date | string; // 反馈提交时间
}

// 房间状态统计
export interface RoomStatusSummary {
  totalRooms: number;
  checkedOutRooms: number;
  cleanedRooms: number;
  readyRooms: number;
}

// 退房请求接口
export interface CheckoutRequest {
  roomId: string;
  mode?: "checkout" | "feedback";
  checkoutId?: string;
  stayRating?: StayRating;
  guestNote?: string;
}

// 更新房间状态请求接口
export interface UpdateRoomStatusRequest {
  roomId: string;
  status: CheckoutStatus;
  staffNote?: string;
}
