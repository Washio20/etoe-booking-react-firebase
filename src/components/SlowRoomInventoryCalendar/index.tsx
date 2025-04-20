import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";

interface SlowRoomInventoryCalendarProps {
  initialInventory?: Record<string, number>; // 格式: { "2023-04-17": 10, ... }
  onChange: (inventory: Record<string, number>) => void;
}

const weekDays = ["日", "月", "火", "水", "木", "金", "土"];
const monthNames = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

export default function SlowRoomInventoryCalendar({
  initialInventory = {},
  onChange,
}: SlowRoomInventoryCalendarProps) {
  // 默认在库数量设置
  const [defaultInventory, setDefaultInventory] = useState<number>(10);

  // 当前显示的月份
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const today = new Date();
    today.setDate(1); // 设置为月初
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // 当前显示的日期数组（整个月）
  const [dates, setDates] = useState<Date[]>([]);

  // 各日期的在库数设置
  const [inventory, setInventory] =
    useState<Record<string, number>>(initialInventory);

  // 格式化日期为YYYY-MM-DD
  const formatDate = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  // 判断日期是否为过去日期
  const isPastDate = useCallback((date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }, []);

  // 计算月份中的所有日期
  const getDatesInMonth = useCallback((date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();

    // 获取当月的第一天
    const firstDay = new Date(year, month, 1);

    // 获取当月的最后一天
    const lastDay = new Date(year, month + 1, 0);

    // 生成日历表格需要的所有日期（包括前后月份的日期用于填充）
    const datesArray: Date[] = [];

    // 计算第一天是星期几，在前面添加上个月的日期
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      datesArray.push(prevDate);
    }

    // 添加当月的所有日期
    for (let i = 1; i <= lastDay.getDate(); i++) {
      datesArray.push(new Date(year, month, i));
    }

    // 计算需要添加的下个月日期数量，使总数为7的倍数（填满整周）
    const remainingDays = 7 - (datesArray.length % 7);
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        datesArray.push(new Date(year, month + 1, i));
      }
    }

    return datesArray;
  }, []);

  // 更新日期数组
  useEffect(() => {
    const newDates = getDatesInMonth(currentMonth);
    setDates(newDates);
  }, [currentMonth, getDatesInMonth]);

  // 判断月份是否为当前月或更早
  const isCurrentMonthOrEarlier = useCallback(() => {
    const today = new Date();
    today.setDate(1);
    today.setHours(0, 0, 0, 0);

    return (
      currentMonth.getFullYear() < today.getFullYear() ||
      (currentMonth.getFullYear() === today.getFullYear() &&
        currentMonth.getMonth() <= today.getMonth())
    );
  }, [currentMonth]);

  // 处理前一个月按钮点击
  const handlePreviousMonth = useCallback(() => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  }, [currentMonth]);

  // 处理下一个月按钮点击
  const handleNextMonth = useCallback(() => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  }, [currentMonth]);

  // 处理今天按钮点击
  const handleTodayClick = useCallback(() => {
    const today = new Date();
    today.setDate(1);
    today.setHours(0, 0, 0, 0);
    setCurrentMonth(today);
  }, []);

  // 处理在库数变更
  const handleInventoryChange = useCallback(
    (date: Date, value: string) => {
      const dateStr = formatDate(date);
      const newValue = parseInt(value, 10) || 0;

      // 更新本地状态
      const newInventory = { ...inventory, [dateStr]: newValue };
      setInventory(newInventory);

      // 调用父组件提供的onChange函数
      onChange(newInventory);
    },
    [inventory, formatDate, onChange]
  );

  // 处理默认在库数变更
  const handleDefaultInventoryChange = useCallback((value: string) => {
    const newValue = parseInt(value, 10) || 0;
    setDefaultInventory(newValue);
  }, []);

  // 将默认在库数应用到所有未设置的未来日期
  const applyDefaultToFutureDates = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 获取未来3个月的所有日期
    const futureDates: Date[] = [];
    const currentDate = new Date(today);

    for (let i = 0; i < 90; i++) {
      // 生成未来90天的数据
      futureDates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 为所有未来日期应用默认在库数
    const newInventory = { ...inventory };
    futureDates.forEach((date) => {
      const dateStr = formatDate(date);
      if (!newInventory[dateStr]) {
        newInventory[dateStr] = defaultInventory;
      }
    });

    // 更新本地状态和父组件
    setInventory(newInventory);
    onChange(newInventory);
  }, [defaultInventory, formatDate, inventory, onChange]);

  // 检查日期是否是当前月
  const isCurrentMonthDate = useCallback(
    (date: Date) => {
      return date.getMonth() === currentMonth.getMonth();
    },
    [currentMonth]
  );

  return (
    <div className="space-y-4">
      {/* 默认在库数设置 */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 p-4 bg-gray-50 rounded-md border border-gray-200">
        <div className="text-sm font-medium text-gray-700 whitespace-nowrap">
          デフォルト在庫数:
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            value={defaultInventory}
            onChange={(e) => handleDefaultInventoryChange(e.target.value)}
            className="w-20 px-2 py-1 border border-gray-300 rounded-md text-center"
          />
          <button
            type="button"
            onClick={applyDefaultToFutureDates}
            className="px-3 py-1 bg-[#AB9F8D] text-white text-sm rounded-md hover:bg-[#9A8F7E] transition-colors"
          >
            未設定の日付に適用
          </button>
        </div>
        <div className="text-xs text-gray-500 md:ml-2">
          ※ 未設定の日付には自動的にこの数値が使用されます
        </div>
      </div>

      {/* 月导航按钮 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTodayClick}
            className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1"
          >
            <CalendarIcon className="w-4 h-4" />
            <span>今日</span>
          </button>
        </div>
        <div className="text-lg font-medium text-gray-700">
          {`${currentMonth.getFullYear()}年${
            monthNames[currentMonth.getMonth()]
          }`}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`w-8 h-8 flex items-center justify-center border border-gray-300 rounded-full hover:bg-gray-100`}
            onClick={handlePreviousMonth}
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-full hover:bg-gray-100"
            onClick={handleNextMonth}
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* 日期表格 - 整月视图 */}
      <div className="border border-gray-300 rounded-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300">
          <thead>
            <tr>
              {weekDays.map((day, index) => (
                <th
                  key={index}
                  className={`px-2 py-2 text-center text-sm font-medium ${
                    index === 0
                      ? "bg-red-50 text-red-700"
                      : index === 6
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil(dates.length / 7) }).map(
              (_, weekIndex) => (
                <tr key={weekIndex}>
                  {dates
                    .slice(weekIndex * 7, weekIndex * 7 + 7)
                    .map((date, dayIndex) => {
                      const dateStr = formatDate(date);
                      const isPast = isPastDate(date);
                      const isCurrentMonth = isCurrentMonthDate(date);

                      return (
                        <td
                          key={dayIndex}
                          className={`p-1 text-center border ${
                            isCurrentMonth ? "" : "bg-gray-50"
                          }`}
                        >
                          <div className="flex flex-col items-center">
                            <div
                              className={`text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                                isPast
                                  ? "text-gray-400"
                                  : isCurrentMonth
                                  ? "text-gray-700"
                                  : "text-gray-400"
                              } ${
                                new Date().toDateString() ===
                                date.toDateString()
                                  ? "bg-indigo-100 font-bold"
                                  : ""
                              }`}
                            >
                              {date.getDate()}
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={
                                inventory[dateStr] !== undefined
                                  ? inventory[dateStr]
                                  : defaultInventory
                              }
                              onChange={(e) =>
                                handleInventoryChange(date, e.target.value)
                              }
                              disabled={isPast || !isCurrentMonth}
                              className={`w-12 px-1 py-0.5 text-sm border border-gray-300 rounded-md text-center ${
                                isPast || !isCurrentMonth
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : "bg-white text-gray-700"
                              }`}
                            />
                          </div>
                        </td>
                      );
                    })}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 italic">
        ※
        各日付の最大予約可能数を設定します。スロールームは時間帯ではなく日付ごとの在庫管理となります。
      </div>
    </div>
  );
}
