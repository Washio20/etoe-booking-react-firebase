// 房间卡状态
export enum RoomCardStatus {
  PENDING = "pending", // 创建中
  ACTIVE = "active", // 有效
  EXPIRED = "expired", // 已过期
  CANCELLED = "cancelled", // 已取消
}

// 定义Firestore Timestamp类型
export interface FirestoreTimestamp {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
}

// 预约接口定义
export interface Reservation {
  id: string;
  userId: string;
  userEmail: string;
  userFullName?: string;
  userPhone?: string;
  userGender?: "male" | "female" | "";
  userBirthdate?: string;
  // 新字段 - Timestamp
  bookingDate: FirestoreTimestamp | Date | null;
  startDateTime: FirestoreTimestamp | Date | null;
  endDateTime: FirestoreTimestamp | Date | null;
  // 慢房间相关
  slowRoomAsSetPlan?: boolean;
  slowRoomStartDateTime?: FirestoreTimestamp | Date | null;
  slowRoomEndDateTime?: FirestoreTimestamp | Date | null;
  // 显示用字段
  displayDate?: string;
  displayTimeRange?: string;
  displaySlowRoomTimeRange?: string;
  // 兼容旧字段
  reservationDate?: string;
  reservationTime?: string;
  roomType: string;
  plan?: string;
  price: string;
  paymentStatus: string;
  paymentId?: string;
  createdAt: FirestoreTimestamp | Date | string;
  updatedAt?: FirestoreTimestamp | Date | string;
  // 优惠券相关信息
  couponId?: string;
  discountAmount?: number;
  // 取消相关信息
  cancelledAt?: FirestoreTimestamp | Date | string;
  cancelledBy?: {
    uid: string;
    email: string;
    type: string;
  };
  refund?: {
    id: string;
    amount: number;
    createdAt: FirestoreTimestamp | Date | string;
    status: string;
  };
  confirmationEmailSent?: boolean;
  confirmationEmailSentAt?: any;
  cancellationEmailSent?: boolean;
  cancellationEmailSentAt?: any;
  cardEmailSent?: boolean;
  cardEmailSentAt?: any;
}

// 房间卡信息
export interface RoomCard {
  id: string; // 卡ID
  reservationId: string; // 对应的预约ID
  cardNumber: string; // 卡号
  cardKey: string; // 卡Key (SNA返回的)
  barcode: string; // 条形码内容
  qrcode: string; // 二维码内容
  physicalRoomId: string; // 物理房间ID (如 room_101)
  deviceId: string; // 设备ID (如 hotel-door-101)
  startAt: string; // 生效时间
  endAt: string; // 失效时间
  status: RoomCardStatus; // 状态
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
}

// 房间分配记录
export interface RoomAssignment {
  id: string; // 分配ID
  reservationId: string; // 预约ID
  roomType: string; // 房间类型
  physicalRoomId: string; // 分配的物理房间ID
  startDateTime: string; // 使用开始时间
  endDateTime: string; // 使用结束时间
  slowRoomId?: string; // 关联的Slow Room ID (如果有)
  status: string; // 状态
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
}
