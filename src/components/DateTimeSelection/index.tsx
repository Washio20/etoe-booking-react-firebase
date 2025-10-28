"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import DateTimeTable from "../DateTimeTable";
import Precautions from "../Precautions";
import ImprovedSlowRoomSelection from "../ImprovedSlowRoomSelection";
import { TimeSlot } from "../types";
import { auth } from "@/utils/firebase";
import { onAuthStateChange } from "@/utils/auth";
import { RoomType } from "@/types/room";
import { saveTempReservation } from "@/utils/tempReservation";
import { STAFF_USER_IDS } from "@/constants/staff";

// 是否为纯sauna房间
const isPureSaunaRoom = (roomType: string): boolean => {
  return ["tototo", "fuuu", "zabuun", "toron"].includes(roomType);
};

// 星期几标签
const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

// 时间段可用状态接口
interface TimeSlotAvailability {
  startTime: string;
  endTime: string;
  timeSlot: string;
  overlappingReservations: number;
  maxReservations: number;
  isAvailable: boolean;
  availableCount: number;
}

interface Props {
  selectedRoomType: RoomType;
}

export default function DateTimeSelection({ selectedRoomType }: Props) {
  const router = useRouter();
  const [user, setUser] = useState(auth.currentUser);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate] = useState(new Date());
  const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(
    null
  );
  const [selectedTimeIndex, setSelectedTimeIndex] = useState<number | null>(
    null
  );
  const [showSlowRoomSelection, setShowSlowRoomSelection] = useState(false);
  const [skipSlowRoom, setSkipSlowRoom] = useState(true);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [slowRoomAvailabilityError, setSlowRoomAvailabilityError] = useState<
    string | null
  >(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSlowRoomAvailable, setIsSlowRoomAvailable] = useState(true);

  // 选定日期和时间段的信息
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [selectedTimeSlotPrice, setSelectedTimeSlotPrice] = useState<number>(0);

  // 时间段可用性数据
  const [timeSlotAvailability, setTimeSlotAvailability] = useState<
    TimeSlotAvailability[]
  >([]);
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false);

  // Slow Room时间选择相关状态
  const [startHour, setStartHour] = useState<number | null>(null);
  const [startMinute, setStartMinute] = useState<string | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);
  const [endMinute, setEndMinute] = useState<string | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<{
    price: number;
    hours: number;
  }>({ price: 0, hours: 0 });

  // 日期数据
  const [dates, setDates] = useState<Date[]>([]);

  // 添加新的状态存储slow room设置
  const [slowRoomSettings, setSlowRoomSettings] = useState<{
    prices: Array<{
      timeRange: string;
      price: number;
      displayPrice: string;
      timeRangeType: string;
    }>;
    imageUrl?: string | null;
    images?: string[] | null;
  } | null>(null);

  // 创建选定日期对象
  const selectedDate = useMemo(() => {
    if (!selectedDateStr) return null;
    return new Date(selectedDateStr);
  }, [selectedDateStr]);

  // 判定当前用户是否为工作人员
  const isStaffUser = useMemo(() => {
    if (!user) return false;
    return STAFF_USER_IDS.includes(user.uid);
  }, [user]);

  const currentUserId = useMemo(() => user?.uid ?? null, [user]);
  const maxWeeksToDisplay = isStaffUser ? 6 : 3;

  // 初始化日期数组
  useEffect(() => {
    const newDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      return date;
    });
    setDates(newDates);
  }, [currentDate]);

  // 当开始时间变化时，确保结束时间始终大于开始时间
  useEffect(() => {
    if (
      startHour === null ||
      startMinute === null ||
      endHour === null ||
      endMinute === null
    ) {
      return;
    }

    if (
      endHour <= startHour ||
      (endHour === startHour && endMinute <= startMinute)
    ) {
      // 确保结束时间不超过23:40
      if (startHour + 1 > 23) {
        setEndHour(23);
        setEndMinute("40");
      } else {
        setEndHour(startHour + 1);
        setEndMinute(startMinute);
      }
    }
  }, [startHour, startMinute, endHour, endMinute]);

  // 获取时间段可用性信息 - 改进版本
  const fetchTimeSlotAvailability = useCallback(
    async (dateStr: string) => {
      if (!dateStr || !isPureSaunaRoom(selectedRoomType)) return;

      try {
        setIsLoadingTimeSlots(true);

        const params = new URLSearchParams({
          date: dateStr,
          isSetPlan: "true",
        });

        if (currentUserId) {
          params.append("userId", currentUserId);
        }

        const response = await fetch(
          `/api/slow-room-availability-day?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`);
        }

        const data = await response.json();

        // 确保响应数据有效
        if (!data.timeSlots || !Array.isArray(data.timeSlots)) {
          throw new Error("无效的时间槽数据");
        }

        // 数据处理改进：确保10:00时间槽的正确处理
        const processedSlots = data.timeSlots.map(
          (slot: TimeSlotAvailability) => {
            // 如果availableCount > 0但isAvailable为false，修正该值
            if (slot.availableCount > 0 && !slot.isAvailable) {
              return { ...slot, isAvailable: true };
            }
            return slot;
          }
        );

        setTimeSlotAvailability(processedSlots);
      } catch (error) {
        console.error("获取时间段可用性失败:", error);
        setTimeSlotAvailability([]);
      } finally {
        setIsLoadingTimeSlots(false);
      }
    },
    [selectedRoomType, currentUserId]
  );

  // 当选中日期变化时，获取该日期的时间段可用性
  useEffect(() => {
    if (selectedDateStr && isPureSaunaRoom(selectedRoomType)) {
      fetchTimeSlotAvailability(selectedDateStr);
    } else {
      setTimeSlotAvailability([]);
    }
  }, [selectedDateStr, fetchTimeSlotAvailability, selectedRoomType]);

  // 获取slow room设置
  useEffect(() => {
    const fetchSlowRoomSettings = async () => {
      try {
        const response = await fetch("/api/rooms?roomType=slow_room");
        if (!response.ok) {
          throw new Error("Failed to fetch slow room settings");
        }
        const data = await response.json();
        if (data.rooms && data.rooms.length > 0) {
          const room = data.rooms[0];
          setSlowRoomSettings({
            prices: Array.isArray(room.prices) ? room.prices : [],
            imageUrl: room.imageUrl ?? null,
            images: Array.isArray(room.images) ? room.images : [],
          });
        }
      } catch (error) {
        console.error("获取Slow Room设置失败:", error);
      }
    };

    // 只要是纯sauna房间，就获取slow room设置，以便显示缩略图等信息
    if (isPureSaunaRoom(selectedRoomType)) {
      fetchSlowRoomSettings();
    }
  }, [selectedRoomType]);

  const slowRoomGallery = useMemo(() => {
    if (!slowRoomSettings) return [];

    const additionalImages = Array.isArray(slowRoomSettings.images)
      ? slowRoomSettings.images
      : [];

    const sources = [slowRoomSettings.imageUrl, ...additionalImages].filter(
      (src): src is string => Boolean(src)
    );

    const uniqueSources = Array.from(new Set(sources));

    if (uniqueSources.length >= 3) {
      return [uniqueSources[0], uniqueSources[2], uniqueSources[1]];
    }

    return uniqueSources.slice(0, 3);
  }, [slowRoomSettings]);

  // 判断日期是否为周末或假日
  const isWeekendOrHolidayDate = useCallback((date: Date): boolean => {
    // 判断是否为周末（周六或周日）
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0是周日，6是周六

    if (isWeekend) return true;

    // 检查是否为日本法定假日
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    // 日本主要节假日列表（简化版）
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

    return HOLIDAYS_2025.includes(dateStr);
  }, []);

  // 计算价格
  const calculatePrice = useCallback(
    (startH: number, startM: string, endH: number, endM: string) => {
      if (
        startH === null ||
        startM === null ||
        endH === null ||
        endM === null
      ) {
        setSelectedPrice({ price: 0, hours: 0 });
        return;
      }

      // 计算精确的小时差
      const startMinutes = startH * 60 + parseInt(startM);
      const endMinutes = endH * 60 + parseInt(endM);
      const diffMinutes = endMinutes - startMinutes;

      // 计算实际小时数（不取整，用于显示）
      const actualHours = diffMinutes / 60;

      // 计算小时数（向上取整到整小时）
      let totalHours = Math.ceil(diffMinutes / 60);

      // 确保至少2小时
      if (totalHours < 2) {
        totalHours = 2;
      }

      // 计算价格
      let basePrice;

      // 检查是否是周末或假日
      const isHolidayOrWeekend = selectedDateStr
        ? isWeekendOrHolidayDate(new Date(selectedDateStr))
        : false;

      // 从slowRoomSettings中获取价格，如果没有则使用默认值
      if (
        slowRoomSettings &&
        slowRoomSettings.prices &&
        slowRoomSettings.prices.length > 0
      ) {
        // 根据时间和日期类型获取对应的价格设置
        if (isHolidayOrWeekend) {
          // 土日祝日价格
          const weekendPrice = slowRoomSettings.prices.find(
            (p) => p.timeRangeType === "weekend"
          );
          basePrice = weekendPrice ? weekendPrice.price : 8900; // 默认8900
        } else {
          // 平日价格，需要根据开始时间判断价格区间
          if (startH >= 10 && startH < 16) {
            // 平日白天10:00-16:00
            const weekdayDayPrice = slowRoomSettings.prices.find(
              (p) => p.timeRangeType === "weekday_day"
            );
            basePrice = weekdayDayPrice ? weekdayDayPrice.price : 6900; // 默认6900
          } else {
            // 平日晚上16:00-25:00
            const weekdayNightPrice = slowRoomSettings.prices.find(
              (p) => p.timeRangeType === "weekday_night"
            );
            basePrice = weekdayNightPrice ? weekdayNightPrice.price : 7900; // 默认7900
          }
        }
      } else {
        // 如果没有获取到设置，使用默认价格
        if (isHolidayOrWeekend) {
          // 土日祝日价格：两小时起步价8900
          basePrice = 8900;
        } else {
          // 平日价格，需要根据开始时间判断价格区间
          if (startH >= 10 && startH < 16) {
            // 平日白天10:00-16:00：两小时起步价6900
            basePrice = 6900;
          } else {
            // 平日晚上16:00-25:00：两小时起步价7900
            basePrice = 7900;
          }
        }
      }

      // 获取每小时额外费用，默认为1500
      const hourlyAddition = 1500;

      // 计算总价：基础价格 + 额外小时费用
      let price;
      if (totalHours === 2) {
        price = basePrice;
      } else {
        // 计算超出2小时的部分，每小时加hourlyAddition
        price = basePrice + (totalHours - 2) * hourlyAddition;
      }

      // 计算实际的小时差（用于显示）
      const displayHours =
        actualHours < 2 ? 2 : parseFloat(actualHours.toFixed(1));

      setSelectedPrice({ price, hours: displayHours });
    },
    [selectedDateStr, isWeekendOrHolidayDate, slowRoomSettings]
  );

  // 重置错误状态
  const resetErrorState = useCallback(() => {
    setSlowRoomAvailabilityError(null);
    setIsSlowRoomAvailable(true);
    setIsCheckingAvailability(false);
  }, []);

  // 重置时间选择
  const resetTimeSelection = useCallback(() => {
    setStartHour(null);
    setStartMinute(null);
    setEndHour(null);
    setEndMinute(null);
    setSelectedPrice({ price: 0, hours: 0 });
    resetErrorState();
  }, [resetErrorState]);

  // 房间类型变化时，重置状态
  useEffect(() => {
    setSelectedDateIndex(null);
    setSelectedTimeIndex(null);
    setSelectedDateStr(null);
    setSelectedTimeSlot(null);
    setSelectedTimeSlotPrice(0);
    setShowSlowRoomSelection(false);
    setSkipSlowRoom(true);
    resetTimeSelection();
    setAgreeToTerms(false);
    setShowTermsError(false);
  }, [selectedRoomType, resetTimeSelection]);

  // 添加Firebase认证状态监听
  useEffect(() => {
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 检查Slow Room可用性
  const checkSlowRoomAvailability = useCallback(
    async (dateStr: string, startTimeStr: string, endTimeStr: string) => {
      try {
        // 标记为正在检查，先清除之前的错误状态
        setIsCheckingAvailability(true);
        setSlowRoomAvailabilityError(null);

        // 检查结束时间是否超过23:40
        const [endHour, endMinute] = endTimeStr.split(":").map(Number);
        if (endHour > 23 || (endHour === 23 && endMinute > 40)) {
          setIsSlowRoomAvailable(false);
          setSlowRoomAvailabilityError("終了時間は23:40までです。別の時間を選択してください。");
          return;
        }

        // 调用API检查可用性
        const params = new URLSearchParams({
          date: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          isSetPlan: "true",
        });

        if (currentUserId) {
          params.append("userId", currentUserId);
        }

        const response = await fetch(
          `/api/slow-room-availability?${params.toString()}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `API请求失败: ${response.status}`);
        }

        const data = await response.json();

        if (!data.isAvailable) {
          setIsSlowRoomAvailable(false);
          setSlowRoomAvailabilityError(
            data.message ||
              "選択した時間帯は利用できません。別の時間帯を選択してください。"
          );
        } else {
          setIsSlowRoomAvailable(true);
          setSlowRoomAvailabilityError(null);
        }
      } catch (error) {
        console.error("检查Slow Room可用性时出错:", error);
        setIsSlowRoomAvailable(false);
        const errorMessage = error instanceof Error ? error.message : "チェック中にエラーが発生しました。後でもう一度お試しください。";
        setSlowRoomAvailabilityError(errorMessage);
      } finally {
        setIsCheckingAvailability(false);
      }
    },
    [currentUserId]
  );

  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // 统一处理时间变化和检查可用性的回调函数
  const handleTimeChange = useCallback(() => {
    // 只有当全部时间参数都设置后才执行
    if (
      startHour === null ||
      startMinute === null ||
      endHour === null ||
      endMinute === null
    ) {
      return;
    }

    // 计算价格
    calculatePrice(startHour, startMinute, endHour, endMinute);

    // 只有当选择了日期时间且不跳过slow room时才检查可用性
    if (selectedDateStr && !skipSlowRoom && isPureSaunaRoom(selectedRoomType)) {
      // 清除上一次的超时
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      // 设置可用性检查状态
      setIsCheckingAvailability(true);

      // 格式化开始和结束时间
      const startTimeStr = `${String(startHour).padStart(
        2,
        "0"
      )}:${startMinute}`;
      const endTimeStr = `${String(endHour).padStart(2, "0")}:${endMinute}`;

      // 添加延迟，防止用户快速连续修改时频繁调用API
      timeoutIdRef.current = setTimeout(() => {
        checkSlowRoomAvailability(selectedDateStr, startTimeStr, endTimeStr);
      }, 500);
    } else {
      setIsCheckingAvailability(false);
      setSlowRoomAvailabilityError(null);
    }
  }, [
    calculatePrice,
    startHour,
    startMinute,
    endHour,
    endMinute,
    selectedDateStr,
    skipSlowRoom,
    selectedRoomType,
    checkSlowRoomAvailability,
  ]);

  // 单一的useEffect监听时间变化
  useEffect(() => {
    handleTimeChange();

    // 清理函数
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [
    startHour,
    startMinute,
    endHour,
    endMinute,
    selectedDateStr,
    skipSlowRoom,
    selectedRoomType,
    handleTimeChange,
  ]);

  // 处理开始时间变更
  const handleStartTimeChange = useCallback(
    (hour: number, minute: string) => {
      setStartHour(hour);
      setStartMinute(minute);

      // 如果结束时间未设置或小于开始时间，自动设置为开始时间+2小时
      if (
        endHour === null ||
        endMinute === null ||
        endHour < hour + 2 ||
        (endHour === hour + 2 && endMinute <= minute)
      ) {
        // 确保结束时间不超过23:40
        if (hour + 2 > 23) {
          setEndHour(23);
          setEndMinute("40");
        } else {
          setEndHour(hour + 2);
          setEndMinute(minute);
        }
      }
    },
    [endHour, endMinute]
  );

  // 处理结束时间变更
  const handleEndTimeChange = useCallback((hour: number, minute: string) => {
    // 确保结束时间不超过23:40
    if (hour > 23 || (hour === 23 && minute > "40")) {
      setEndHour(23);
      setEndMinute("40");
    } else {
      setEndHour(hour);
      setEndMinute(minute);
    }
  }, []);

  // 处理时间段选择
  const handleTimeSlotSelection = (
    dateIndex: number,
    timeIndex: number,
    timeSlotData?: any
  ) => {
    // 处理清空选择的特殊情况（由切换周功能触发）
    if (dateIndex === -1 && timeIndex === -1) {
      setSelectedDateIndex(null);
      setSelectedTimeIndex(null);
      setSelectedDateStr(null);
      setSelectedTimeSlot(null);
      setSelectedTimeSlotPrice(0);
      setShowSlowRoomSelection(false);
      return;
    }

    // 检查是否选择了新的日期
    const isNewDateSelected =
      selectedDateIndex !== dateIndex ||
      (timeSlotData &&
        timeSlotData.date &&
        selectedDateStr !== timeSlotData.date);

    setSelectedDateIndex(dateIndex);
    setSelectedTimeIndex(timeIndex);

    // 保存选中的日期和时间段
    if (timeSlotData && timeSlotData.date) {
      // 如果当前日期与新选择的日期不同，则更新日期
      const newSelectedDateStr = timeSlotData.date;
      if (selectedDateStr !== newSelectedDateStr) {
        setSelectedDateStr(newSelectedDateStr);

        // 在套餐预约场景下，日期改变时重置slow room时间选择
        if (isPureSaunaRoom(selectedRoomType)) {
          setStartHour(null);
          setStartMinute(null);
          setEndHour(null);
          setEndMinute(null);
          setSelectedPrice({ price: 0, hours: 0 });
          resetErrorState();
        }
      }

      // 更新当前选中的日期，以便Slow Room部分显示正确的日期
      const selectedDate = new Date(timeSlotData.date);
      const newDates = [...dates];
      if (dateIndex >= 0 && dateIndex < newDates.length) {
        newDates[dateIndex] = selectedDate;
        setDates(newDates);
      }
    } else if (dateIndex !== null && dateIndex < dates.length) {
      const newSelectedDateStr = dates[dateIndex].toISOString().split("T")[0];
      if (selectedDateStr !== newSelectedDateStr) {
        setSelectedDateStr(newSelectedDateStr);

        // 在套餐预约场景下，日期改变时重置slow room时间选择
        if (isPureSaunaRoom(selectedRoomType)) {
          setStartHour(null);
          setStartMinute(null);
          setEndHour(null);
          setEndMinute(null);
          setSelectedPrice({ price: 0, hours: 0 });
          resetErrorState();
        }
      }
    }

    // 保存时间段和价格信息
    if (timeSlotData) {
      setSelectedTimeSlot(timeSlotData.time);
      setSelectedTimeSlotPrice(timeSlotData.price || 0);
    }

    // 只在选择纯sauna房间时才显示slow_room选项
    if (isPureSaunaRoom(selectedRoomType)) {
      setShowSlowRoomSelection(true);
    } else {
      setShowSlowRoomSelection(false);
      setSkipSlowRoom(true);
    }
  };

  // 处理预约按钮点击
  const handleReservation = async () => {
    if (!agreeToTerms) {
      setShowTermsError(true);
      return;
    }

    // 如果是纯sauna房间且用户选择了slow room并且有错误，阻止提交
    if (
      isPureSaunaRoom(selectedRoomType) &&
      !skipSlowRoom &&
      slowRoomAvailabilityError
    ) {
      return;
    }

    // 获取所选日期和时间段对应的价格
    let timeSlotPrice = selectedTimeSlotPrice;
    let selectedTimeValue = selectedTimeSlot;

    // 获取选中的日期
    let selectedDateValue = selectedDateStr
      ? new Date(selectedDateStr).toISOString()
      : null;

    // 创建预约信息对象
    const selectedInfo = {
      selectedRoomType,
      selectedDate: selectedDateValue,
      selectedTime: selectedTimeValue,
      timeSlotPrice: timeSlotPrice,
      // 只有纯sauna房间才需要考虑slow room选项
      needSlowRoom: isPureSaunaRoom(selectedRoomType) ? !skipSlowRoom : false,
      slowRoomTimeRange:
        isPureSaunaRoom(selectedRoomType) && !skipSlowRoom
          ? {
              startTime: `${String(startHour).padStart(2, "0")}:${startMinute}`,
              endTime: `${String(endHour).padStart(2, "0")}:${endMinute}`,
              price: selectedPrice.price,
              hours: selectedPrice.hours,
            }
          : null,
    };

    // 将信息存储到localStorage
    localStorage.setItem("reservationInfo", JSON.stringify(selectedInfo));

    // 对于未登录用户，保存临时预约数据
    if (!user) {
      try {
        // 保存到Firestore
        const reservationId = await saveTempReservation(selectedInfo);
        
        console.log("sauna预约信息已临时保存，ID:", reservationId);
        if (reservationId) {
          // 将ID保存到localStorage，以便在同设备场景中使用
          localStorage.setItem("reservationId", reservationId);
        }
      } catch (error) {
        console.error("Failed to save reservation:", error);
        // 即使保存失败，也继续跳转
      }
    }
    
    // 无论用户是否登录，都直接跳转到预约确认页面
    router.push("/reservation/confirm");
  };

  // 处理checkbox变化
  const handleTermsChange = () => {
    setAgreeToTerms(!agreeToTerms);
    if (showTermsError) setShowTermsError(false);
  };

  // 如果正在加载
  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-12">
        <div className="border-b border-[rgba(68,68,68,0.2)] pb-0 md:pb-4">
          <div className="pb-[8px] md:pb-0">
            <h1 className="text-base md:text-2xl font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
              日時を選んでください
            </h1>
          </div>
        </div>
        <div className="flex justify-center py-8">
          <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-12">
      <div className="border-b border-[rgba(68,68,68,0.2)] pb-0 md:pb-4">
        <div className="pb-[8px] md:pb-0">
          <h1 className="text-base md:text-2xl font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
            日時を選んでください
          </h1>
        </div>
      </div>

      <DateTimeTable
        selectedRoomType={selectedRoomType}
        dates={dates}
        timeSlots={[]} // 传递空数组，DateTimeTable会自行获取时间槽
        selectedDateIndex={selectedDateIndex}
        selectedTimeIndex={selectedTimeIndex}
        onTimeSlotSelect={handleTimeSlotSelection}
        currentUserId={currentUserId}
        maxWeeks={maxWeeksToDisplay}
      />

      {/* 当前选择信息展示区域 */}
      {selectedDateStr && selectedTimeSlot && (
        <div className="mt-4 md:mt-6 p-4 rounded-md bg-[#F0EAE4]">
          <div className="flex flex-col space-y-2">
            <div className="text-base md:text-lg text-[#444444] font-zen-kaku-gothic">
              <span className="font-bold">{selectedRoomType.replace(/_/g, ' ')}部屋料金：</span><span className="font-bold text-red-600">{selectedTimeSlotPrice.toLocaleString()}円</span><span className="text-sm ml-1">(税込)</span>
            </div>
            <div className="text-base md:text-base text-[#444444] font-zen-kaku-gothic">
            <span className="font-bold">選択日時：</span>{selectedDateStr.replace(/-/g, '/')} {selectedDate && `(${weekDays[selectedDate.getDay()]})`} {selectedTimeSlot}
            </div>
          </div>
        </div>
      )}

      {/* 使用改进的SlowRoomSelection组件 */}
      {showSlowRoomSelection && selectedDateIndex !== null && (
        <ImprovedSlowRoomSelection
          selectedDate={selectedDate}
          selectedDateStr={selectedDateStr}
          skipSlowRoom={skipSlowRoom}
          setSkipSlowRoom={setSkipSlowRoom}
          startHour={startHour}
          startMinute={startMinute}
          endHour={endHour}
          endMinute={endMinute}
          selectedPrice={selectedPrice}
          timeSlotAvailability={timeSlotAvailability}
          isLoadingTimeSlots={isLoadingTimeSlots}
          isCheckingAvailability={isCheckingAvailability}
          slowRoomAvailabilityError={slowRoomAvailabilityError}
          onStartTimeChange={handleStartTimeChange}
          onEndTimeChange={handleEndTimeChange}
          slowRoomImages={slowRoomGallery}
        />
      )}

      {/* 利用规约同意チェックボックス */}
      <div className="flex justify-center items-center mb-6 md:mb-6">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="agree-to-terms"
              className="w-4 h-4 md:w-5 md:h-5 accent-[#444444]"
              checked={agreeToTerms}
              onChange={handleTermsChange}
            />
            <label
              htmlFor="agree-to-terms"
              className="text-base text-[#444444] font-zen-kaku-gothic cursor-pointer"
            >
              利用規約に同意する
            </label>
          </div>
          {showTermsError && (
            <p className="text-red-600 text-base mt-2 font-zen-kaku-gothic">
              利用規約に同意してください。
            </p>
          )}
        </div>
      </div>

      {/* 予約確認画面へ按钮 */}
      <div
        className="my-8 md:my-14 flex justify-center"
        style={{ marginTop: "20px", marginBottom: "40px" }}
      >
        <button
          className={`w-full md:w-auto px-10 md:px-24 py-3 md:py-3 h-12 md:h-auto rounded-full font-zen-kaku-gothic text-white text-sm md:text-base font-medium transition-colors ${
            selectedDateIndex !== null &&
            selectedTimeIndex !== null &&
            // 非纯sauna房间，只要选择了日期和时间就可以点击
            (!isPureSaunaRoom(selectedRoomType) ||
              // 纯sauna房间的情况：选择了日期、时间，并且满足以下条件之一：
              // 1. 跳过slow room
              // 2. 未跳过slow room，且已填写完slow room的必要信息
              (isPureSaunaRoom(selectedRoomType) &&
                (skipSlowRoom ||
                  (!skipSlowRoom &&
                    selectedPrice &&
                    startHour !== null &&
                    startMinute !== null &&
                    endHour !== null &&
                    endMinute !== null &&
                    !slowRoomAvailabilityError))))
              ? "bg-gray-700 hover:bg-gray-800"
              : "bg-[#BBBBBB] cursor-not-allowed"
          }`}
          disabled={
            selectedDateIndex === null ||
            selectedTimeIndex === null ||
            (isPureSaunaRoom(selectedRoomType) &&
              !skipSlowRoom &&
              (!selectedPrice ||
                startHour === null ||
                startMinute === null ||
                endHour === null ||
                endMinute === null ||
                Boolean(slowRoomAvailabilityError) ||
                isCheckingAvailability))
          }
          onClick={handleReservation}
        >
          予約確認画面へ
        </button>
      </div>

      {/* 注意事项 */}
      <Precautions />
    </div>
  );
}
