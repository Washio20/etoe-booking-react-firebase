import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Info, Clock, AlertCircle, Square, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

interface TimelineSlotProps {
  hour: number;
  minute: string;
  isStart: boolean;
  isSelected: boolean;
  isAvailable: boolean;
  availableCount?: number;
  maxReservations?: number;
  onClick: () => void;
  isTimePassed?: boolean;
}

const TimelineSlot = ({
  hour,
  minute,
  isStart,
  isSelected,
  isAvailable,
  availableCount,
  maxReservations,
  onClick,
  isTimePassed,
}: TimelineSlotProps) => {
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

      {/* {isAvailable &&
        availableCount !== undefined &&
        maxReservations !== undefined && (
          <div className="absolute bottom-0 right-0 px-0.5 py-0">
            <span className="text-[10px] text-gray-500">
              {availableCount}/{maxReservations}
            </span>
          </div>
        )} */}
    </button>
  );
};

interface TimeSlotAvailability {
  startTime: string;
  isAvailable: boolean;
  availableCount?: number;
  maxReservations?: number;
}

interface TimeRangeSelectorProps {
  startHour: number | null;
  startMinute: string | null;
  endHour: number | null;
  endMinute: string | null;
  timeSlotAvailability: TimeSlotAvailability[];
  onStartTimeChange: (hour: number, minute: string) => void;
  onEndTimeChange: (hour: number, minute: string) => void;
  selectedDate: Date | null;
}

const TimeRangeSelector = ({
  startHour,
  startMinute,
  endHour,
  endMinute,
  timeSlotAvailability,
  onStartTimeChange,
  onEndTimeChange,
  selectedDate,
}: TimeRangeSelectorProps) => {
  // 开始时间显示14:00 - 19:40
  const startHours = Array.from({ length: 6 }, (_, i) => i + 14);
  // 结束时间显示16:00 - 21:40
  const endHours = Array.from({ length: 6 }, (_, i) => i + 16);
  const minutes = ["00", "20", "40"];

  // 检查时间是否过期（当天日期的当前时间之前）
  const isTimePassedForToday = useCallback(
    (hour: number, minute: string) => {
      if (!selectedDate) return false;

      // 判断是否是当天
      const today = new Date();
      const isToday =
        selectedDate.getDate() === today.getDate() &&
        selectedDate.getMonth() === today.getMonth() &&
        selectedDate.getFullYear() === today.getFullYear();

      if (!isToday) return false;

      const currentHour = today.getHours();
      const currentMinute = today.getMinutes();

      // 检查时间是否已过（考虑30分钟的缓冲时间）
      return (
        hour < currentHour ||
        (hour === currentHour && parseInt(minute) <= currentMinute + 30)
      );
    },
    [selectedDate]
  );

  // Find availability info for a specific time slot
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

  // Handle start time selection
  const handleStartTimeSelect = (hour: number, minute: string) => {
    // 检查是否超出开始时间最大限制（19:40）
    const isOverStartMaxTime = hour === 19 && parseInt(minute) > 40;
    if (isOverStartMaxTime) return;
    
    const { isAvailable } = getAvailabilityInfo(hour, minute);
    if (!isAvailable) return;

    onStartTimeChange(hour, minute);
  };

  // Handle end time selection
  const handleEndTimeSelect = (hour: number, minute: string) => {
    onEndTimeChange(hour, minute);
  };

  // Check if end time is valid (must be after start time)
  const isValidEndTime = (hour: number, minute: string) => {
    if (startHour === null || startMinute === null) return false;

    const endTime = hour * 60 + parseInt(minute);
    const currentStartTime = startHour * 60 + parseInt(startMinute);
    return endTime > currentStartTime;
  };

  // Check if a time is selected
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-700" />
          <h3 className="text-sm font-medium text-gray-700 font-zen-kaku-gothic">
            開始時間
          </h3>
          {startHour === null && (
            <span className="text-xs text-red-600">
              ※開始時間を選択してください
            </span>
          )}
        </div>

        <div className="grid grid-cols-6 md:grid-cols-6 lg:grid-cols-6 gap-2">
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
                ? ""
                : "※終了時間を選択してください"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-6 md:grid-cols-6 lg:grid-cols-6 gap-2">
          {endHours.map((hour) => (
            <div
              key={`end-hour-${hour}`}
              className="space-y-1"
            >
              <div className="text-center text-xs text-gray-500 font-bold">
                {hour}時
              </div>
              <div className="space-y-1">
                {minutes.map((minute) => {
                  // 添加一个判断，检查该时间是否超出21:40
                  const isOverMaxTime = hour === 21 && parseInt(minute) > 40;
                  // 对于开始时间，添加特殊处理19:40作为最大值
                  const isOverStartMaxTime = hour === 19 && parseInt(minute) > 40;
                  const isAvailable =
                    startHour !== null && 
                    isValidEndTime(hour, minute) && 
                    !isOverMaxTime;
                  const isTimePassed = isTimePassedForToday(hour, minute);
                  return (
                    <TimelineSlot
                      key={`end-${hour}-${minute}`}
                      hour={hour}
                      minute={minute}
                      isStart={false}
                      isSelected={isTimeSelected(hour, minute, false)}
                      isAvailable={isAvailable}
                      availableCount={undefined}
                      maxReservations={undefined}
                      isTimePassed={isTimePassed}
                      onClick={() =>
                        isAvailable && handleEndTimeSelect(hour, minute)
                      }
                    />
                  );
                })}
              </div>
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

const SlowRoomAvailabilityLegend = () => {
  return (
    <div className="flex flex-wrap gap-3 mb-4 text-sm md:text-base text-[#444444] font-zen-kaku-gothic">
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-green-50 border border-gray-200"></div>
        <span>空き</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-gray-100 border border-gray-200"></div>
        <span>満席</span>
      </div>
    </div>
  );
};

interface SelectedPrice {
  price: number;
  hours: number;
}

interface ImprovedSlowRoomSelectionProps {
  selectedDate: Date | null;
  selectedDateStr?: string | null;
  skipSlowRoom: boolean;
  setSkipSlowRoom: (skip: boolean) => void;
  startHour: number | null;
  startMinute: string | null;
  endHour: number | null;
  endMinute: string | null;
  selectedPrice: SelectedPrice | null;
  timeSlotAvailability: TimeSlotAvailability[];
  isLoadingTimeSlots: boolean;
  isCheckingAvailability: boolean;
  slowRoomAvailabilityError: string | null;
  onStartTimeChange: (hour: number, minute: string) => void;
  onEndTimeChange: (hour: number, minute: string) => void;
  slowRoomImages?: string[];
}

// Improved SlowRoomSelection component to replace in DateTimeSelection
export default function ImprovedSlowRoomSelection({
  selectedDate,
  selectedDateStr,
  skipSlowRoom,
  setSkipSlowRoom,
  startHour,
  startMinute,
  endHour,
  endMinute,
  selectedPrice,
  timeSlotAvailability,
  isLoadingTimeSlots,
  isCheckingAvailability,
  slowRoomAvailabilityError,
  onStartTimeChange,
  onEndTimeChange,
  slowRoomImages,
}: ImprovedSlowRoomSelectionProps) {
  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

  // Format the selected date display
  const formattedDateDisplay = selectedDate
    ? `${selectedDate.getFullYear()}年${
        selectedDate.getMonth() + 1
      }月${selectedDate.getDate()}日(${weekDays[selectedDate.getDay()]})`
    : "";

  const processedSlowRoomImages = useMemo(() => {
    if (!slowRoomImages || slowRoomImages.length === 0) return [];
    const unique: string[] = [];
    slowRoomImages.forEach((src) => {
      if (src && !unique.includes(src)) {
        unique.push(src);
      }
    });
    return unique.slice(0, 3);
  }, [slowRoomImages]);

  const [slowRoomActiveIndex, setSlowRoomActiveIndex] = useState(0);
  const slowRoomTouchStartRef = useRef<number | null>(null);

  const totalSlowRoomImages = processedSlowRoomImages.length;

  useEffect(() => {
    setSlowRoomActiveIndex(0);
  }, [totalSlowRoomImages]);

  const showSlowRoomControls = totalSlowRoomImages > 1;
  const currentSlowRoomImage =
    processedSlowRoomImages[slowRoomActiveIndex] ?? null;

  const handleSlowRoomNext = useCallback(() => {
    if (totalSlowRoomImages <= 1) return;
    setSlowRoomActiveIndex((prev) => {
      const nextIndex = (prev + 1) % totalSlowRoomImages;
      return nextIndex;
    });
  }, [totalSlowRoomImages]);

  const handleSlowRoomPrev = useCallback(() => {
    if (totalSlowRoomImages <= 1) return;
    setSlowRoomActiveIndex((prev) => {
      const nextIndex = (prev - 1 + totalSlowRoomImages) % totalSlowRoomImages;
      return nextIndex;
    });
  }, [totalSlowRoomImages]);

  const handleSlowRoomDotClick = useCallback((index: number) => {
    setSlowRoomActiveIndex(index);
  }, []);

  const handleSlowRoomTouchStart = useCallback((clientX: number) => {
    slowRoomTouchStartRef.current = clientX;
  }, []);

  const handleSlowRoomTouchEnd = useCallback(
    (clientX: number) => {
      if (!showSlowRoomControls) {
        slowRoomTouchStartRef.current = null;
        return;
      }
      const startX = slowRoomTouchStartRef.current;
      slowRoomTouchStartRef.current = null;
      if (startX === null) return;
      const diff = startX - clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          handleSlowRoomNext();
        } else {
          handleSlowRoomPrev();
        }
      }
    },
    [showSlowRoomControls, handleSlowRoomNext, handleSlowRoomPrev]
  );

  return (
    <div className="mt-8 md:mt-16 space-y-6 p-4 rounded-md bg-[#F0EAE4]">
      <div className="pb-4 flex flex-col md:flex-row md:justify-between md:items-start">
        <div className="w-full">
          <div className="flex flex-row items-center flex-wrap gap-2 md:gap-3">
            <h2 className="text-base md:text-lg text-[#444444] font-bold font-zen-kaku-gothic">
              オプション：客室の日帰りホカンスセットプラン（2名まで）
            </h2>
            <span className="inline-block text-xs md:text-sm font-bold text-[#D77777] border-2 border-[#D77777] rounded px-2 py-0.5 whitespace-nowrap font-zen-kaku-gothic">
              セットで¥1,000円お得
            </span>
          </div>
          <p className="text-sm md:text-base text-[#444444] mt-2 font-zen-kaku-gothic">
            サウナの前後を、ふたりだけの客室でゆったりと。
            <br />
            レコードの音､ゆるやかに流れるシアター、心地よい余韻にお楽しみください。ご利用は2時間から。
          </p>
          {processedSlowRoomImages.length > 0 && currentSlowRoomImage && (
            <div className="mt-4 md:flex md:justify-center">
              <div
                className="relative w-full aspect-[3/2] md:w-[360px] md:max-w-full rounded-lg overflow-hidden"
                onTouchStart={(event) => {
                  event.stopPropagation();
                  if (!showSlowRoomControls) return;
                  if (event.touches && event.touches[0]) {
                    handleSlowRoomTouchStart(event.touches[0].clientX);
                  }
                }}
                onTouchMove={(event) => event.stopPropagation()}
                onTouchEnd={(event) => {
                  event.stopPropagation();
                  if (!showSlowRoomControls) return;
                  if (event.changedTouches && event.changedTouches[0]) {
                    handleSlowRoomTouchEnd(event.changedTouches[0].clientX);
                  }
                }}
              >
                <Image
                  key={currentSlowRoomImage}
                  src={currentSlowRoomImage}
                  alt="Slow Room"
                  fill
                  sizes="(min-width: 768px) 360px, 100vw"
                  className="object-cover transition-transform duration-300"
                />
                {showSlowRoomControls && (
                  <>
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 md:flex"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSlowRoomPrev();
                      }}
                      aria-label="前の画像を見る"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 md:flex"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSlowRoomNext();
                      }}
                      aria-label="次の画像を見る"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
                      {processedSlowRoomImages.map((imageSrc, index) => (
                        <button
                          key={`${imageSrc}-${index}`}
                          type="button"
                          className={`h-2 w-2 rounded-full transition ${
                            index === slowRoomActiveIndex
                              ? "bg-white"
                              : "bg-white/50 hover:bg-white/80"
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSlowRoomDotClick(index);
                          }}
                          aria-label={`画像${index + 1}を表示`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 mt-2">
            <input
              type="checkbox"
              id="skip-slow-room"
              className="w-4 h-4 md:w-4 md:h-4 accent-[#444444] mt-1"
              checked={!skipSlowRoom}
              onChange={() => setSkipSlowRoom(!skipSlowRoom)}
            />
            <label
              htmlFor="skip-slow-room"
              className="text-base text-[#444444] font-zen-kaku-gothic cursor-pointer whitespace-nowrap"
            >
              ホカンスプランを利用する
            </label>
          </div>
        </div>
      </div>

      {!skipSlowRoom && (
        <div className="border border-[#BBBBBB] rounded-lg p-4 md:p-6 bg-white">
          <div className="mb-4 text-sm md:text-base text-[#444444] font-zen-kaku-gothic font-bold">
            {formattedDateDisplay}
          </div>

          {/* Loading state */}
          {isLoadingTimeSlots && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-4 border-[#C78C51] border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-3 text-gray-500 font-zen-kaku-gothic">
                時間枠の空き状況を確認中...
              </span>
            </div>
          )}

          {/* Time selection explanation and legend */}
          {!isLoadingTimeSlots && (
            <>
              <div className="text-sm md:text-base text-[#444444] mb-4 font-zen-kaku-gothic">
                <p>※ 時間は20分単位でご予約いただけます</p>
                <p>※ 2時間からご利用可能です（2時間6900円～/ 3時間8400円～）</p>
              </div>

              <SlowRoomAvailabilityLegend />

              {/* Timeline-based time selection */}
              <TimeRangeSelector
                startHour={startHour}
                startMinute={startMinute}
                endHour={endHour}
                endMinute={endMinute}
                timeSlotAvailability={timeSlotAvailability}
                selectedDate={selectedDate}
                onStartTimeChange={(hour: number, minute: string) => {
                  onStartTimeChange(hour, String(minute).padStart(2, "0"));
                }}
                onEndTimeChange={(hour: number, minute: string) => {
                  onEndTimeChange(hour, String(minute).padStart(2, "0"));
                }}
              />
            </>
          )}

          {/* Error state */}
          {slowRoomAvailabilityError && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-3 rounded">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="ml-2 text-sm text-red-600 font-zen-kaku-gothic">
                  {slowRoomAvailabilityError}
                </p>
              </div>
            </div>
          )}

          {/* Checking availability state */}
          {isCheckingAvailability && !slowRoomAvailabilityError && (
            <div className="mt-4 flex items-center justify-center text-gray-500 text-sm font-zen-kaku-gothic">
              <div className="h-4 w-4 border-2 border-[#C78C51] border-t-transparent rounded-full animate-spin mr-2"></div>
              空き状況を確認中...
            </div>
          )}

          {/* Price display */}
          {selectedPrice && !isLoadingTimeSlots && !isCheckingAvailability && (
            <div className="mt-4 p-3 bg-[#F0EAE4] rounded-md">
              <div className="text-left text-base md:text-lg text-[#444444] font-zen-kaku-gothic">
                <span className="font-bold">slow room 部屋料金：</span>
                <span className="font-bold text-red-600">¥{selectedPrice.price.toLocaleString()}</span>
                <span className="text-sm ml-1">(税込)</span>
                {/* {startHour !== null &&
                  startMinute !== null &&
                  endHour !== null &&
                  endMinute !== null && (
                    <div className="text-sm text-gray-600">
                      {selectedPrice.hours}時間 (
                      {String(startHour).padStart(2, "0")}:{startMinute} 〜{" "}
                      {String(endHour).padStart(2, "0")}:{endMinute})
                    </div>
                  )} */}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
