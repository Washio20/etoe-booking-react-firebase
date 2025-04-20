// API响应的房间可用性数据类型
export interface RoomAvailabilityResponse {
  roomId: string;
  roomName: string;
  startDate: string;
  endDate: string;
  timeSlots: {
    [date: string]: {
      dayOfWeek: string;
      isHoliday: boolean;
      slots: {
        time: string;
        status: "○" | "△" | "×";
        price: number;
      }[];
    };
  };
}

// 时间槽类型
export interface TimeSlot {
  time: string;
  availability: ("○" | "△" | "×")[];
}
