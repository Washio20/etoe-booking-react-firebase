import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/utils/firebase";
import { onAuthStateChange } from "@/utils/auth";
import { RoomType } from "@/types/room";
import {
  Calendar,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Precautions from "../Precautions";

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

// 时间槽组件接口
interface TimelineSlotProps {
  hour: number;
  minute: string;
  isStart: boolean;
  isSelected: boolean;
  isAvailable: boolean;
  availableCount?: number;
  maxReservations?: number;
  onClick: () => void;
  isTimePassed?: boolean; // 添加新属性，表示时间是否已过期
}

// 时间槽组件
const TimelineSlot: React.FC<TimelineSlotProps> = ({
  hour,
  minute,
  isStart,
  isSelected,
  isAvailable,
  availableCount,
  maxReservations,
  onClick,
  isTimePassed,
}) => {
  // Format time string (e.g., "10:00")
  const timeStr = `${String(hour).padStart(2, "0")}:${minute}`;

  // Determine background color based on availability
  const getBackgroundColor = () => {
    if (isSelected) return "bg-[#C78C51] bg-opacity-20";
    if (!isAvailable) return "bg-gray-100";

    // 只保留可用（绿色）和不可用（灰色）两种状态
    return "bg-green-50"; // 空き
  };

  return (
    <button
      onClick={onClick}
      disabled={!isAvailable && isStart}
      className={`relative flex items-center justify-center h-10 w-full rounded 
        ${getBackgroundColor()}
        ${
          isAvailable
            ? "border border-gray-200 hover:border-gray-400"
            : "border border-gray-200"
        }
        ${isSelected ? "border-[#C78C51] border-2" : ""}
        transition-all duration-150`}
    >
      {/* 只在时间未过期时显示时间文本 */}
      {!isTimePassed && (
        <span className="text-sm font-medium text-gray-700">{timeStr}</span>
      )}

      {!isAvailable && isStart && !isTimePassed && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 rounded">
          <span className="text-xs text-red-500 font-bold flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            満席
          </span>
        </div>
      )}

      {isAvailable &&
        availableCount !== undefined &&
        maxReservations !== undefined && (
          <div className="absolute bottom-0 right-0 px-0.5 py-0">
            <span className="text-[10px] text-gray-500">
              {availableCount}/{maxReservations}
            </span>
          </div>
        )}
    </button>
  );
};

// 时间范围选择器接口
interface TimeRangeSelectorProps {
  startHour: number | null;
  startMinute: string | null;
  endHour: number | null;
  endMinute: string | null;
  timeSlotAvailability: TimeSlotAvailability[];
  onStartTimeChange: (hour: number, minute: string) => void;
  onEndTimeChange: (hour: number, minute: string) => void;
  selectedDate: Date | null; // 添加新属性，表示选择的日期
}

// 时间范围选择器 - 调整布局，减少列数，增加按钮宽度
const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  startHour,
  startMinute,
  endHour,
  endMinute,
  timeSlotAvailability,
  onStartTimeChange,
  onEndTimeChange,
  selectedDate,
}) => {
  // 所有可选小时 (9:00 - 24:00)
  const startHours = Array.from({ length: 15 }, (_, i) => i + 9);
  const endHours = Array.from({ length: 16 }, (_, i) => i + 9);
  const minutes = ["00", "20", "40"];

  // 查找指定时间的可用性信息
  const getAvailabilityInfo = (hour: number, minute: string) => {
    const timeStr = `${String(hour).padStart(2, "0")}:${minute}`;
    const slot = timeSlotAvailability.find(
      (slot) => slot.startTime === timeStr
    );

    // 检查时间是否已过期（当天的当前时间之前）
    const isTimePassed = isTimePassedForToday(hour, minute);

    if (!slot)
      return {
        isAvailable: !isTimePassed, // 如果时间已过，则不可用
        availableCount: undefined,
        maxReservations: undefined,
        isTimePassed, // 返回时间是否已过期
      };

    // 如果时间已过，即使API返回可用也标记为不可用
    if (isTimePassed) {
      return {
        isAvailable: false,
        availableCount: slot.availableCount,
        maxReservations: slot.maxReservations,
        isTimePassed: true, // 设置时间已过期
      };
    }

    return {
      isAvailable: slot.isAvailable,
      availableCount: slot.availableCount,
      maxReservations: slot.maxReservations,
      isTimePassed: false, // 设置时间未过期
    };
  };

  // 处理开始时间选择
  const handleStartTimeSelect = (hour: number, minute: string) => {
    const { isAvailable } = getAvailabilityInfo(hour, minute);
    if (!isAvailable) return;

    onStartTimeChange(hour, minute);
  };

  // 处理结束时间选择
  const handleEndTimeSelect = (hour: number, minute: string) => {
    onEndTimeChange(hour, minute);
  };

  // 检查结束时间是否有效（必须在开始时间之后）
  const isValidEndTime = (hour: number, minute: string) => {
    if (startHour === null || startMinute === null) return false;

    const endTime = hour * 60 + parseInt(minute);
    const currentStartTime = startHour * 60 + parseInt(startMinute);
    return endTime > currentStartTime;
  };

  // 检查时间是否被选中
  const isTimeSelected = (hour: number, minute: string, isStart: boolean) => {
    if (isStart) {
      return (
        startHour !== null &&
        startMinute !== null &&
        hour === startHour &&
        minute === startMinute
      );
    } else {
      return (
        endHour !== null &&
        endMinute !== null &&
        hour === endHour &&
        minute === endMinute
      );
    }
  };

  // 检查时间是否已过期（当天的当前时间之前）
  const isTimePassedForToday = (hour: number, minute: string) => {
    if (
      !selectedDate ||
      selectedDate.toDateString() !== new Date().toDateString()
    )
      return false;

    const currentTime = new Date();
    const selectedTime = new Date(
      currentTime.getFullYear(),
      currentTime.getMonth(),
      currentTime.getDate(),
      hour,
      parseInt(minute)
    );

    // 加上30分钟的缓冲时间
    const bufferTime = 30 * 60 * 1000;
    return selectedTime.getTime() < currentTime.getTime() + bufferTime;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-700" />
          <h3 className="text-sm font-medium text-gray-700 font-zen-kaku-gothic">
            開始時間
          </h3>
          {startHour === null && (
            <span className="text-xs text-amber-600">
              ※開始時間を選択してください
            </span>
          )}
        </div>

        <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {startHours.map((hour) => (
            <div key={`start-hour-group-${hour}`} className="space-y-1">
              <div className="text-center text-xs text-gray-500 font-bold">
                {hour}時
              </div>
              <div className="space-y-1">
                {minutes.map((minute) => {
                  const {
                    isAvailable,
                    availableCount,
                    maxReservations,
                    isTimePassed,
                  } = getAvailabilityInfo(hour, minute);
                  return (
                    <TimelineSlot
                      key={`start-${hour}-${minute}`}
                      hour={hour}
                      minute={minute}
                      isStart={true}
                      isSelected={isTimeSelected(hour, minute, true)}
                      isAvailable={isAvailable}
                      availableCount={availableCount}
                      maxReservations={maxReservations}
                      isTimePassed={isTimePassed}
                      onClick={() => handleStartTimeSelect(hour, minute)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-700" />
          <h3 className="text-sm font-medium text-gray-700 font-zen-kaku-gothic">
            終了時間
          </h3>
          {(endHour === null || startHour === null) && (
            <span className="text-xs text-amber-600">
              {startHour === null
                ? "※まず開始時間を選択してください"
                : "※終了時間を選択してください"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-12 gap-1">
          {endHours.map((hour) => (
            <div
              key={`end-hour-${hour}`}
              className="col-span-3 md:col-span-2 lg:col-span-1 space-y-1"
            >
              {minutes.map((minute) => {
                const isAvailable =
                  startHour !== null && isValidEndTime(hour, minute);
                const isTimePassed = isTimePassedForToday(hour, minute);
                return (
                  <TimelineSlot
                    key={`end-${hour}-${minute}`}
                    hour={hour}
                    minute={minute}
                    isStart={false}
                    isSelected={isTimeSelected(hour, minute, false)}
                    isAvailable={isAvailable}
                    isTimePassed={isTimePassed}
                    onClick={() =>
                      isAvailable && handleEndTimeSelect(hour, minute)
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 bg-gray-50 rounded-md">
        <div className="flex justify-between items-center">
          <div className="font-zen-kaku-gothic text-sm text-gray-700">
            選択した時間:{" "}
            {startHour !== null &&
            startMinute !== null &&
            endHour !== null &&
            endMinute !== null ? (
              <span className="font-bold">
                {String(startHour).padStart(2, "0")}:{startMinute} 〜{" "}
                {String(endHour).padStart(2, "0")}:{endMinute}
              </span>
            ) : (
              <span className="text-gray-500">時間を選択してください</span>
            )}
          </div>
          {startHour !== null &&
            startMinute !== null &&
            endHour !== null &&
            endMinute !== null && (
              <div className="text-sm font-medium text-gray-700 font-zen-kaku-gothic">
                {(() => {
                  // 计算小时差
                  const hoursDiff =
                    ((endHour - startHour) * 60 +
                      (parseInt(endMinute) - parseInt(startMinute))) /
                    60;

                  // 格式化为最多一位小数
                  return parseFloat(hoursDiff.toFixed(1));
                })()}{" "}
                時間
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

// 可用性图例
const SlowRoomAvailabilityLegend = () => {
  return (
    <div className="flex flex-wrap gap-3 mb-4 text-xs text-[#444444] font-zen-kaku-gothic">
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-green-50 border border-gray-200 mr-1"></div>
        <span>空き</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-gray-100 border border-gray-200 mr-1"></div>
        <span>満席</span>
      </div>
    </div>
  );
};

// 日历选择组件接口
interface DateSelectorProps {
  selectedDate: Date | null;
  onDateChange: (date: Date) => void;
}

// 日历选择组件
const DateSelector: React.FC<DateSelectorProps> = ({
  selectedDate,
  onDateChange,
}) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // 获取当月的所有日期
  const getDaysInMonth = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    // 获取月初是周几
    const startDayOfWeek = firstDay.getDay();

    // 生成日历网格
    const days = [];

    // 计算本月初的日期和当前日期
    const currentDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    // 如果当前月份和年份与日历显示的一致，则从当天开始显示
    const startingDate =
      currentYear === today.getFullYear() && currentMonth === today.getMonth()
        ? today.getDate()
        : 1;

    // 计算日历网格的起始位置
    const firstDayPosition = startDayOfWeek;

    // 如果显示当前月份，并且从当天开始显示
    if (
      currentYear === today.getFullYear() &&
      currentMonth === today.getMonth()
    ) {
      // 填充从月初到当天前的空白
      const currentDayPosition = firstDayPosition + startingDate - 1;
      for (let i = 0; i < currentDayPosition; i++) {
        days.push(null);
      }

      // 填充从当天开始的日期
      for (let i = startingDate; i <= lastDay.getDate(); i++) {
        const date = new Date(currentYear, currentMonth, i);
        days.push(date);
      }
    } else {
      // 填充月初前的空白
      for (let i = 0; i < startDayOfWeek; i++) {
        days.push(null);
      }

      // 填充当月的日期
      for (let i = 1; i <= lastDay.getDate(); i++) {
        const date = new Date(currentYear, currentMonth, i);
        days.push(date);
      }
    }

    return days;
  };

  // 处理上个月按钮点击
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  // 处理下个月按钮点击
  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 检查是否可以点击上个月按钮
  const canClickPrevMonth = () => {
    // 如果当前显示的是当前月份，则不允许查看上个月
    if (
      currentYear === today.getFullYear() &&
      currentMonth === today.getMonth()
    ) {
      return false;
    }

    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return new Date(prevYear, prevMonth + 1, 0) >= today;
  };

  // 检查是否是选中的日期
  const isSelectedDate = (date: Date | null) => {
    if (!date || !selectedDate) return false;

    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // 检查是否是今天
  const isToday = (date: Date | null) => {
    if (!date) return false;

    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // 获取日期按钮样式
  const getDateButtonStyle = (date: Date | null) => {
    if (!date)
      return "text-gray-300 bg-white border-gray-200 cursor-not-allowed";

    const dayOfWeek = date.getDay();

    if (isSelectedDate(date)) {
      return "bg-[#C78C51] bg-opacity-20 border-[#C78C51] border-2 text-[#444444] font-bold hover:bg-[#C78C51] hover:bg-opacity-30";
    } else if (isToday(date)) {
      return "border-[#C78C51] border-2 text-[#444444] hover:bg-[#C78C51] hover:bg-opacity-10";
    } else if (dayOfWeek === 0) {
      // 周日
      return "border-rose-200 text-rose-500 hover:bg-rose-50";
    } else if (dayOfWeek === 6) {
      // 周六
      return "border-blue-200 text-blue-500 hover:bg-blue-50";
    } else {
      return "border-gray-200 text-[#444444] hover:bg-gray-50";
    }
  };

  const days = getDaysInMonth();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handlePrevMonth}
          disabled={!canClickPrevMonth()}
          className={`w-8 h-8 flex items-center justify-center rounded-full border-2 shadow-sm transition-colors ${
            canClickPrevMonth()
              ? "border-[#444444] text-[#444444] hover:bg-gray-100"
              : "text-gray-300 border-gray-300 cursor-not-allowed opacity-50"
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-base font-medium text-[#444444] font-zen-kaku-gothic">
          {currentYear}年{currentMonth + 1}月
        </h3>
        <button
          onClick={handleNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#444444] text-[#444444] hover:bg-gray-100 shadow-sm transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-2 font-zen-kaku-gothic rounded-md ${
              index === 0
                ? "bg-[#D77777] text-[#444444]"
                : index === 6
                ? "bg-[#6AA3C6] text-[#444444]"
                : "bg-[#444444] text-white"
            } ${index === 0 ? "rounded-l-md" : ""} ${
              index === 6 ? "rounded-r-md" : ""
            }`}
          >
            {day}
          </div>
        ))}

        {days.map((date, index) => (
          <button
            key={index}
            disabled={!date}
            onClick={() => {
              if (date instanceof Date) {
                onDateChange(date);
              }
            }}
            className={`h-10 flex items-center justify-center text-sm border rounded-md shadow-sm transition-all font-zen-kaku-gothic ${
              date instanceof Date
                ? getDateButtonStyle(date)
                : "text-gray-300 bg-white border-gray-200 cursor-not-allowed"
            }`}
          >
            {date instanceof Date ? date.getDate() : ""}
          </button>
        ))}
      </div>
    </div>
  );
};

interface Props {
  selectedRoomType: RoomType;
}

export default function ImprovedPureSlowRoomSelection({
  selectedRoomType,
}: Props) {
  const router = useRouter();
  const [user, setUser] = useState(auth.currentUser);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [startMinute, setStartMinute] = useState<string | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);
  const [endMinute, setEndMinute] = useState<string | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<{
    price: number;
    hours: number;
  }>({ price: 0, hours: 0 });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);

  // 添加新的状态存储slow room设置
  const [slowRoomSettings, setSlowRoomSettings] = useState<{
    prices: Array<{
      timeRange: string;
      price: number;
      displayPrice: string;
      timeRangeType: string;
    }>;
  } | null>(null);

  // 可用性状态
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null
  );
  const [isRoomAvailable, setIsRoomAvailable] = useState(true);
  const [timeSlotAvailability, setTimeSlotAvailability] = useState<
    TimeSlotAvailability[]
  >([]);
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false);

  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // 当组件卸载时清除超时定时器
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  // 添加Firebase认证状态监听
  useEffect(() => {
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // 获取时间段可用性信息
  const fetchTimeSlotAvailability = useCallback(async (dateStr: string) => {
    if (!dateStr) return;

    try {
      setIsLoadingTimeSlots(true);
      console.log(`正在获取日期 ${dateStr} 的时间槽可用性数据`);

      // 调用API获取时间槽可用性
      const response = await fetch(
        `/api/pure-slow-room-availability-day?date=${dateStr}`
      );

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();
      console.log("API返回的时间槽数据:", data);

      // 确保响应数据有效
      if (!data.timeSlots || !Array.isArray(data.timeSlots)) {
        throw new Error("无效的时间槽数据");
      }

      // 处理数据，处理当天的时间槽
      const now = new Date();
      const isToday = dateStr === now.toISOString().split("T")[0];
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const processedSlots = data.timeSlots.map(
        (slot: TimeSlotAvailability) => {
          // 如果是当天，过滤掉已经过去的时间段
          if (isToday) {
            const [slotHour, slotMinute] = slot.startTime
              .split(":")
              .map(Number);

            // 修改时间判断逻辑：
            // 1. 如果当前时间小于10点，保持原有逻辑
            // 2. 如果当前时间大于等于10点，只禁用已经过去的上午时段
            if (currentHour < 10) {
              // 原有逻辑：如果时间槽已经过去（考虑预留30分钟的缓冲时间）
              if (
                slotHour < currentHour ||
                (slotHour === currentHour && slotMinute < currentMinute + 30)
              ) {
                return { ...slot, isAvailable: false };
              }
            } else {
              // 新逻辑：如果当前时间已经过了10点，只禁用上午的时段
              if (slotHour < 12) {
                return { ...slot, isAvailable: false };
              }
            }
          }

          // 修正可用性标记
          if (slot.availableCount > 0 && !slot.isAvailable) {
            return { ...slot, isAvailable: true };
          }
          return slot;
        }
      );

      console.log("处理后的时间槽数据:", processedSlots);
      setTimeSlotAvailability(processedSlots);
    } catch (error) {
      console.error("获取时间段可用性失败:", error);
      setTimeSlotAvailability([]);
    } finally {
      setIsLoadingTimeSlots(false);
    }
  }, []);

  // 当选中日期变化时，获取该日期的时间段可用性
  useEffect(() => {
    if (selectedDateStr) {
      fetchTimeSlotAvailability(selectedDateStr);
    } else {
      setTimeSlotAvailability([]);
    }
  }, [selectedDateStr, fetchTimeSlotAvailability]);

  // 检查房间可用性
  const checkRoomAvailability = useCallback(
    async (dateStr: string, startTimeStr: string, endTimeStr: string) => {
      if (!dateStr) return;

      try {
        setIsCheckingAvailability(true);
        setAvailabilityError(null);

        // 使用纯slow room的API端点
        const response = await fetch(
          `/api/pure-slow-room-availability?date=${dateStr}&startTime=${startTimeStr}&endTime=${endTimeStr}`
        );

        if (!response.ok) {
          throw new Error(`APIエラー: ${response.status}`);
        }

        const data = await response.json();

        if (!data.isAvailable) {
          setIsRoomAvailable(false);
          setAvailabilityError(
            data.message ||
              "選択した時間帯は利用できません。別の時間帯を選択してください。"
          );
        } else {
          setIsRoomAvailable(true);
          setAvailabilityError(null);
        }
      } catch (error) {
        console.error("Slow Room可用性检查失败:", error);
        setIsRoomAvailable(false);
        setAvailabilityError(
          "チェック中にエラーが発生しました。後でもう一度お試しください。"
        );
      } finally {
        setIsCheckingAvailability(false);
      }
    },
    []
  );

  // 判断日期是否为周末或假日
  const isWeekendOrHolidayDate = useCallback((date: Date): boolean => {
    // 判断是否为周末（周六或周日）
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0是周日，6是周六

    if (isWeekend) return true;

    // 检查是否为日本法定假日（这里简化处理，实际应用中可能需要查询更完整的假日数据）
    // 格式化日期为yyyy-MM-dd格式
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
          setSlowRoomSettings(data.rooms[0]);
          console.log("获取到的Slow Room设置:", data.rooms[0]);
        }
      } catch (error) {
        console.error("获取Slow Room设置失败:", error);
      }
    };

    // 获取slow room设置
    fetchSlowRoomSettings();
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
      const isHolidayOrWeekend = selectedDate
        ? isWeekendOrHolidayDate(selectedDate)
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
        console.log("使用数据库中的价格:", basePrice);
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
        console.log("使用默认价格:", basePrice);
      }

      // 计算总价：基础价格 + 额外小时费用
      let price;
      if (totalHours === 2) {
        price = basePrice;
      } else {
        // 计算超出2小时的部分，每小时1500日元
        price = basePrice + (totalHours - 2) * 1500;
      }

      // 计算实际的小时差（用于显示）
      const displayHours =
        actualHours < 2 ? 2 : parseFloat(actualHours.toFixed(1));

      setSelectedPrice({ price, hours: displayHours });
    },
    [selectedDate, isWeekendOrHolidayDate, slowRoomSettings]
  );

  // 处理时间变更和检查可用性
  const handleTimeChange = useCallback(() => {
    // 只有当开始时间和结束时间都选择后才计算价格和检查可用性
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

    // 只有当选择了日期时才检查可用性
    if (selectedDateStr) {
      // 清除上一次的超时
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      setIsCheckingAvailability(true);

      // 增加延迟，防止用户快速连续修改时频繁调用API
      timeoutIdRef.current = setTimeout(() => {
        const startTimeStr = `${String(startHour).padStart(
          2,
          "0"
        )}:${startMinute}`;
        const endTimeStr = `${String(endHour).padStart(2, "0")}:${endMinute}`;

        checkRoomAvailability(selectedDateStr, startTimeStr, endTimeStr);
      }, 300);
    }
  }, [
    calculatePrice,
    startHour,
    startMinute,
    endHour,
    endMinute,
    selectedDateStr,
    checkRoomAvailability,
  ]);

  // 监听时间变化
  useEffect(() => {
    handleTimeChange();
  }, [
    startHour,
    startMinute,
    endHour,
    endMinute,
    selectedDateStr,
    handleTimeChange,
  ]);

  // 处理日期选择
  const handleDateChange = (date: Date) => {
    setSelectedDate(date);

    // 修复：获取准确的本地日期字符串，避免时区问题导致日期偏差
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;

    // 使用格式化后的日期字符串，而不是通过toISOString()方法
    setSelectedDateStr(formattedDate);

    // 日期变更时清除之前选择的时间
    setStartHour(null);
    setStartMinute(null);
    setEndHour(null);
    setEndMinute(null);

    // 重置价格
    setSelectedPrice({ price: 0, hours: 0 });

    console.log(
      `选择的日期: ${date.toDateString()}, 格式化后的日期字符串: ${formattedDate}`
    );
  };

  // 处理开始时间变化
  const handleStartTimeChange = (hour: number, minute: string) => {
    setStartHour(hour);
    setStartMinute(minute);

    // 如果结束时间未设置或小于等于开始时间，调整结束时间为开始时间后2小时
    if (
      endHour === null ||
      endMinute === null ||
      endHour < hour + 2 ||
      (endHour === hour + 2 && endMinute <= minute)
    ) {
      setEndHour(hour + 2);
      setEndMinute(minute);
    }
  };

  // 处理结束时间变化
  const handleEndTimeChange = (hour: number, minute: string) => {
    setEndHour(hour);
    setEndMinute(minute);
  };

  // 处理预约按钮点击
  const handleReservation = () => {
    if (!agreeToTerms) {
      setShowTermsError(true);
      return;
    }

    if (
      !selectedDate ||
      !isRoomAvailable ||
      startHour === null ||
      startMinute === null ||
      endHour === null ||
      endMinute === null
    ) {
      return;
    }

    // 格式化时间
    const formattedStartTime = `${String(startHour).padStart(
      2,
      "0"
    )}:${startMinute}`;
    const formattedEndTime = `${String(endHour).padStart(2, "0")}:${endMinute}`;
    const timeRange = `${formattedStartTime}～${formattedEndTime}`;

    // 保存选择的信息到localStorage
    const selectedInfo = {
      selectedRoomType,
      // 增加新的日期时间字段
      bookingDate: selectedDate.toISOString(),
      startDateTime: new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        startHour,
        parseInt(startMinute)
      ).toISOString(),
      endDateTime: new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        endHour,
        parseInt(endMinute)
      ).toISOString(),
      // 保留原有字段以向后兼容
      selectedDate: selectedDate.toISOString(),
      selectedTime: timeRange,
      timeSlotPrice: selectedPrice.price,
      hours: selectedPrice.hours,
      slowRoomDetails: {
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        price: selectedPrice.price,
        hours: selectedPrice.hours,
      },
    };

    localStorage.setItem("reservationInfo", JSON.stringify(selectedInfo));

    // 检查用户是否已登录
    if (user) {
      // 已登录用户直接跳转到预约确认页面
      router.push("/reservation/confirm");
    } else {
      // 未登录用户跳转到登录页面
      router.push("/login?returnTo=/reservation/confirm");
    }
  };

  // 处理checkbox变化
  const handleTermsChange = () => {
    setAgreeToTerms(!agreeToTerms);
    if (showTermsError) setShowTermsError(false);
  };

  return (
    <div className="space-y-4 md:space-y-12">
      <div className="border-b border-[rgba(68,68,68,0.2)] pb-0 md:pb-4">
        <div className="pb-[8px] md:pb-0">
          <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
            日時を選んでください
          </h1>
        </div>
      </div>

      {/* 布局调整：改为上下结构而非左右结构 */}
      <div className="space-y-6">
        {/* 日付選択 */}
        <div className="border border-[#BBBBBB] rounded-lg p-4 md:p-6 bg-white">
          <div className="flex items-center mb-4 text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic font-bold">
            <Calendar className="h-4 w-4 mr-2" />
            日付を選択してください
          </div>

          <DateSelector
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
        </div>

        {/* 時間選択 */}
        <div className="border border-[#BBBBBB] rounded-lg p-4 md:p-6 bg-white">
          <div className="flex items-center mb-4 text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic font-bold">
            <Clock className="h-4 w-4 mr-2" />
            時間を選択してください
          </div>

          {selectedDate ? (
            <>
              {isLoadingTimeSlots ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 border-4 border-[#C78C51] border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-3 text-gray-500 font-zen-kaku-gothic">
                    時間枠の空き状況を確認中...
                  </span>
                </div>
              ) : (
                <>
                  <div className="text-xs md:text-sm text-gray-600 mb-4 font-zen-kaku-gothic">
                    <p>※ 時間は20分単位でご予約いただけます</p>
                    <p>
                      ※ 2時間からご利用可能です（2時間6900円～/ 3時間8400円～）
                    </p>
                  </div>

                  <SlowRoomAvailabilityLegend />

                  <div className="space-y-4">
                    <TimeRangeSelector
                      startHour={startHour}
                      startMinute={startMinute}
                      endHour={endHour}
                      endMinute={endMinute}
                      timeSlotAvailability={timeSlotAvailability}
                      onStartTimeChange={handleStartTimeChange}
                      onEndTimeChange={handleEndTimeChange}
                      selectedDate={selectedDate}
                    />
                  </div>

                  <div className="mt-6 p-4 rounded-lg bg-[#F0EAE4]">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="text-[#444444] font-zen-kaku-gothic">
                        <p className="text-sm md:text-base">
                          料金:{" "}
                          <span className="font-bold">
                            {selectedPrice.price > 0
                              ? selectedPrice.price.toLocaleString() + "円"
                              : "時間を選択してください"}
                          </span>
                        </p>
                        {selectedPrice.hours > 0 && (
                          <p className="text-xs md:text-sm text-gray-500">
                            （{selectedPrice.hours}時間）
                          </p>
                        )}
                      </div>
                      <div className="text-[#444444] font-zen-kaku-gothic">
                        <p className="text-sm md:text-base">
                          日時:{" "}
                          <span className="font-bold">
                            {selectedDate.getMonth() + 1}月
                            {selectedDate.getDate()}日 (
                            {weekDays[selectedDate.getDay()]})
                          </span>
                        </p>
                        {startHour !== null &&
                          startMinute !== null &&
                          endHour !== null &&
                          endMinute !== null && (
                            <p className="text-sm md:text-base font-bold">
                              {String(startHour).padStart(2, "0")}:{startMinute}{" "}
                              ～ {String(endHour).padStart(2, "0")}:{endMinute}
                            </p>
                          )}
                      </div>
                    </div>
                  </div>

                  {isCheckingAvailability && (
                    <div className="mt-4 flex items-center text-gray-500 font-zen-kaku-gothic">
                      <div className="h-4 w-4 border-2 border-[#C78C51] border-t-transparent rounded-full animate-spin mr-2"></div>
                      空き状況を確認中...
                    </div>
                  )}

                  {availabilityError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-red-600 text-xs md:text-sm font-zen-kaku-gothic flex items-start">
                        <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                        <span>{availabilityError}</span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-gray-500 font-zen-kaku-gothic">
              先に日付を選択してください
            </div>
          )}
        </div>

        {/* 恢复原来的利用规约同意チェックボックス布局 */}
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
                className="text-sm md:text-base text-[#444444] font-zen-kaku-gothic cursor-pointer"
              >
                利用規約に同意する
              </label>
            </div>
            {showTermsError && (
              <p className="text-red-600 text-xs md:text-sm mt-2 font-zen-kaku-gothic">
                利用規約に同意してください。
              </p>
            )}
          </div>
        </div>

        {/* 恢复原来的予約確認画面へボタン布局 */}
        <div
          className="my-8 md:my-14 flex justify-center w-full"
          style={{ marginTop: "20px", marginBottom: "40px" }}
        >
          <button
            className={`w-full md:w-auto px-10 md:px-24 py-3.5 md:py-3 h-12 md:h-auto rounded-full font-zen-kaku-gothic text-white text-xs md:text-sm font-medium transition-colors ${
              selectedDate &&
              isRoomAvailable &&
              startHour !== null &&
              startMinute !== null &&
              endHour !== null &&
              endMinute !== null &&
              !isCheckingAvailability
                ? "bg-gray-700 hover:bg-gray-800"
                : "bg-[#BBBBBB] cursor-not-allowed"
            }`}
            disabled={
              !selectedDate ||
              !isRoomAvailable ||
              startHour === null ||
              startMinute === null ||
              endHour === null ||
              endMinute === null ||
              isCheckingAvailability
            }
            onClick={handleReservation}
          >
            予約確認画面へ
          </button>
        </div>

        {startHour === null && selectedDate && (
          <div className="text-center text-amber-600 text-sm font-zen-kaku-gothic -mt-4 mb-4">
            予約を進めるには時間を選択してください
          </div>
        )}

        {/* 注意事项 */}
        <Precautions />
      </div>
    </div>
  );
}
