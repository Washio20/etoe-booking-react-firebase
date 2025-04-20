// src/types/room.ts
export type RoomType =
  | "tototo"
  | "fuuu"
  | "zabuun"
  | "toron"
  | "sauna_suite"
  | "slow_room";

export type RoomCategory = "private_sauna" | "sauna_suite" | "slow_room";

// 时间段设置接口
export interface TimeSlotDefinition {
  time: string;
  maxReservations?: number;
  pricing?: {
    weekday?: number;
    weekend?: number;
    morning?: number;
    night?: number;
  };
}

export interface PriceInfo {
  timeRange: string;
  price: number;
  displayPrice: string; // 显示用的格式化价格，如"¥16,800"
  timeRangeType:
    | "weekday_day"
    | "weekday_night"
    | "weekend"
    | "overnight_a"
    | "overnight_b";
}

export interface Room {
  id: string;
  roomType: RoomType;
  name: string;
  category: RoomCategory;
  imageUrl: string;
  thumbnailUrl: string;
  prices: PriceInfo[];
  duration: string;
  extension: string;
  description: string;
  capacity: number;
  area: number;
  facilities: string[];
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  timeSlots?: TimeSlotDefinition[]; // 添加时间段配置
  maxReservations?: number;
  dailyInventory?: Record<string, number>; // 添加这一行，用于存储每日的最大预约数
}

// 添加物理房间ID的映射类型
export type PhysicalRoomMapping = {
  [key: string]: string[];
};

// 纯Sauna房间类型到物理房间的映射
export const SAUNA_ROOM_MAPPING: PhysicalRoomMapping = {
  tototo: ["room_101"],
  fuuu: ["room_102"],
  zabuun: ["room_103"],
  toron: ["room_104"],
};

// 套房类型到物理房间的映射
export const SUITE_ROOM_MAPPING: PhysicalRoomMapping = {
  sauna_suite: ["room_201"],
};

// Slow Room类型到物理房间的映射
export const SLOW_ROOM_MAPPING: PhysicalRoomMapping = {
  slow_room: [
    "room_202",
    "room_203",
    "room_204",
    "room_205",
    "room_206",
    "room_301",
    "room_302",
    "room_303",
    "room_304",
    "room_305",
  ],
};

// 房间类型到门禁设备ID的映射
export const ROOM_DEVICE_MAPPING: { [roomId: string]: string } = {
  room_101: "etoehotel-101",
  room_102: "etoehotel-102",
  room_103: "etoehotel-103",
  room_104: "etoehotel-104",
  room_201: "etoehotel-201",
  room_202: "etoehotel-202",
  room_203: "etoehotel-203",
  room_204: "etoehotel-204",
  room_205: "etoehotel-205",
  room_206: "etoehotel-206",
  room_301: "etoehotel-301",
  room_302: "etoehotel-302",
  room_303: "etoehotel-303",
  room_304: "etoehotel-304",
  room_305: "etoehotel-305",
};
