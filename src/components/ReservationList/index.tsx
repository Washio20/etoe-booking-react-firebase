"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";

// 更新预约接口定义
interface Reservation {
  id: string;
  roomType: string;
  roomTypeName: string;
  plan?: string;
  price: number; // 现在是数字类型而非字符串
  paymentStatus: string;
  type?: string;
  reservationType?: string;
  imageUrl?: string;

  // 新的日期时间字段
  bookingDate?: Date;
  startDateTime?: Date;
  endDateTime?: Date;

  // UI显示字段
  displayDate?: string;
  displayTimeRange?: string;

  // 慢房间相关
  slowRoomAsSetPlan?: boolean;
  slowRoomStartDateTime?: Date;
  slowRoomEndDateTime?: Date;
  displaySlowRoomTimeRange?: string;

  // 创建时间
  createdAt?: Date;
  updatedAt?: Date;

  // 向后兼容的字段
  reservationDate?: string;
  reservationTime?: string;
  date?: {
    _seconds: number;
    _nanoseconds: number;
  };
}

const RESERVATIONS_PER_PAGE = 5;

const parseJapaneseDateString = (value: string): Date | null => {
  const trimmed = value.trim();
  const match = trimmed.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeDateValue = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object") {
    const candidate = value as {
      toDate?: () => Date;
      _seconds?: number;
      seconds?: number;
    };

    if (candidate.toDate) {
      const result = candidate.toDate();
      return Number.isNaN(result.getTime()) ? null : result;
    }

    if (typeof candidate._seconds === "number") {
      return new Date(candidate._seconds * 1000);
    }

    if (typeof candidate.seconds === "number") {
      return new Date(candidate.seconds * 1000);
    }
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const fromJapanese = parseJapaneseDateString(value);
    if (fromJapanese) {
      return fromJapanese;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getReservationDateValue = (reservation: Reservation): Date | null => {
  const candidates = [
    reservation.startDateTime,
    reservation.bookingDate,
    reservation.date,
    reservation.displayDate,
    reservation.reservationDate,
    reservation.createdAt,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDateValue(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const HOURS_BEFORE_STANDARD_FREE_CANCEL = 48;
const HOURS_BEFORE_SAUNA_SUITE_PARTIAL_CANCEL = 168;

const getReservationStartTime = (reservation: Reservation): Date | null => {
  if (reservation.startDateTime instanceof Date) {
    return reservation.startDateTime;
  }

  if (reservation.startDateTime && typeof reservation.startDateTime === "object") {
    const startDateTime = reservation.startDateTime as any;

    if (typeof startDateTime.toDate === "function") {
      return startDateTime.toDate();
    }

    if (startDateTime._seconds !== undefined) {
      return new Date(startDateTime._seconds * 1000);
    }
  }

  if (reservation.displayDate && reservation.displayTimeRange) {
    const dateMatch = reservation.displayDate.match(/(\d+)年(\d+)月(\d+)日/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;

      const timeMatch = reservation.displayTimeRange.match(/(\d+):(\d+)/);
      if (timeMatch) {
        const [, startHour, startMinute] = timeMatch;

        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(startHour),
          parseInt(startMinute)
        );
      }
    }
  }

  return null;
};

const getHoursBeforeReservation = (reservation: Reservation): number | null => {
  const reservationStartTime = getReservationStartTime(reservation);
  if (!reservationStartTime) {
    return null;
  }

  const timeDifference = reservationStartTime.getTime() - Date.now();
  return timeDifference / (1000 * 60 * 60);
};

const getCancellationFeePercentage = (reservation: Reservation): number => {
  const hoursBeforeReservation = getHoursBeforeReservation(reservation);
  if (hoursBeforeReservation === null || Number.isNaN(hoursBeforeReservation)) {
    return 100;
  }

  if (reservation.roomType === "sauna_suite") {
    return hoursBeforeReservation >= HOURS_BEFORE_SAUNA_SUITE_PARTIAL_CANCEL
      ? 0
      : hoursBeforeReservation >= HOURS_BEFORE_STANDARD_FREE_CANCEL
        ? 50
        : 100;
  }

  return hoursBeforeReservation >= HOURS_BEFORE_STANDARD_FREE_CANCEL ? 0 : 100;
};

const getCancellationFeeAmount = (
  price: number,
  reservation: Reservation
): number => {
  const feePercentage = getCancellationFeePercentage(reservation);
  const refundPercentage = 100 - feePercentage;
  const refundAmount = Math.floor(price * (refundPercentage / 100));
  return price - refundAmount;
};

const getCancellationPolicyMessage = (reservation: Reservation): string => {
  const hoursBeforeReservation = getHoursBeforeReservation(reservation);

  if (hoursBeforeReservation === null || Number.isNaN(hoursBeforeReservation)) {
    return "予約開始時間を確認できないため、キャンセル料は100%となります。";
  }

  if (reservation.roomType === "sauna_suite") {
    if (hoursBeforeReservation >= HOURS_BEFORE_SAUNA_SUITE_PARTIAL_CANCEL) {
      return "予約開始時間の7日前までのため、キャンセル料はかかりません。";
    }
    if (hoursBeforeReservation >= HOURS_BEFORE_STANDARD_FREE_CANCEL) {
      return "予約開始時間の7日前〜2日前のため、50%のキャンセル料がかかります。";
    }
    return "予約開始時間の48時間を過ぎているため、100%のキャンセル料がかかります。";
  }

  if (hoursBeforeReservation >= HOURS_BEFORE_STANDARD_FREE_CANCEL) {
    return "予約開始時間の48時間前なので、キャンセル料はかかりません。";
  }

  return "予約開始時間の48時間を過ぎているため、100%のキャンセル料がかかります。";
};

export default function ReservationList() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<"current" | "past">("current");
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptName, setReceiptName] = useState("");
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // 确保只在客户端渲染模态框
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 获取用户的预约数据（现在包含房间图片信息）
  useEffect(() => {
    const fetchReservations = async () => {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/user/reservations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("予約データの取得に失敗しました");
        }

        const data = await response.json();
        // 现在后端API已经包含了房间图片信息，直接使用
        setReservations(data.reservations);
      } catch (err) {
        console.error("Error fetching reservations:", err);
        setError(
          err instanceof Error
            ? err.message
            : "予約データの取得中にエラーが発生しました"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, dateFilter]);

  // 判断预约是否已结束的函数
  const isPastReservation = (reservation: Reservation): boolean => {
    // 当前时间
    const now = new Date();
    
    try {
      // 1. 尝试使用endDateTime字段（直接的日期对象）
      if (reservation.endDateTime instanceof Date) {
        return reservation.endDateTime < now;
      }
      
      // 2. 尝试使用displayDate和displayTimeRange解析
      if (reservation.displayDate && reservation.displayTimeRange) {
        // 日期格式: YYYY年MM月DD日
        const dateMatch = reservation.displayDate.match(/(\d+)年(\d+)月(\d+)日/);
        if (dateMatch) {
          const [_, year, month, day] = dateMatch;
          
          // 时间格式: HH:MM～HH:MM
          const timeMatch = reservation.displayTimeRange.match(/\d+:\d+[～〜\-~](\d+):(\d+)/);
          if (timeMatch) {
            const [__, endHour, endMinute] = timeMatch;
            
            const endDate = new Date(
              parseInt(year),
              parseInt(month) - 1, // 月份从0开始
              parseInt(day),
              parseInt(endHour),
              parseInt(endMinute)
            );
            
            return endDate < now;
          }
        }
      }
      
      // 3. 尝试处理Firestore Timestamp对象
      if (reservation.endDateTime && typeof reservation.endDateTime === 'object') {
        const endDateTime = reservation.endDateTime as any;
        
        // 有toDate方法的对象
        if (typeof endDateTime.toDate === 'function') {
          return endDateTime.toDate() < now;
        }
        
        // 原始Firestore时间戳
        if (endDateTime._seconds !== undefined) {
          const endDate = new Date(endDateTime._seconds * 1000);
          return endDate < now;
        }
      }
    } catch (e) {
      console.error("判断预约是否已结束时出错:", e);
    }
    
    // 默认情况，无法判断则视为未结束
    return false;
  };
  
  // 按照当前/过去标签过滤预约
  const getFilteredReservations = () => {
    // 首先过滤预约
    const filtered = reservations.filter((reservation) => {
      const isPast = isPastReservation(reservation);
      
      if (activeTab === "current") {
        // 当前预约：已支付且未结束
        return reservation.paymentStatus === "paid" && !isPast;
      } else {
        // 过去预约：已取消或已结束
        return reservation.paymentStatus === "cancelled" || isPast;
      }
    });
    
    // 然后根据标签类型进行排序
    return filtered.sort((a, b) => {
      // 获取预约的时间戳
      const getReservationTimestamp = (res: Reservation): number => {
        // 尝试使用startDateTime
        if (res.startDateTime instanceof Date) {
          return res.startDateTime.getTime();
        }
        
        // 尝试从displayDate和displayTimeRange解析
        if (res.displayDate && res.displayTimeRange) {
          try {
            // 解析日期 (格式: YYYY年MM月DD日)
            const dateMatch = res.displayDate.match(/(\d+)年(\d+)月(\d+)日/);
            if (dateMatch) {
              const [_, year, month, day] = dateMatch;
              
              // 解析时间 (格式: HH:MM～HH:MM)
              const timeMatch = res.displayTimeRange.match(/(\d+):(\d+)/);
              if (timeMatch) {
                const [__, startHour, startMinute] = timeMatch;
                
                const date = new Date(
                  parseInt(year),
                  parseInt(month) - 1,
                  parseInt(day),
                  parseInt(startHour),
                  parseInt(startMinute)
                );
                
                return date.getTime();
              }
            }
          } catch (e) {
            console.error("解析日期时间出错:", e);
          }
        }
        
        // 如果无法获取时间，使用创建时间
        if (res.createdAt instanceof Date) {
          return res.createdAt.getTime();
        }
        
        // 如果上述都失败，返回0
        return 0;
      };
      
      const timestampA = getReservationTimestamp(a);
      const timestampB = getReservationTimestamp(b);
      
      if (activeTab === "current") {
        // 当前预约：按时间倒序（日期最近的在前）
        return timestampB - timestampA;
      } else {
        // 过去预约：按时间降序（最近结束的在前）
        return timestampB - timestampA;
      }
    });
  };
  
  // 获取筛选和排序后的预约列表
  const tabFilteredReservations = getFilteredReservations();

  const filteredReservations = tabFilteredReservations.filter(
    (reservation) => {
      if (!dateFilter) {
        return true;
      }

      const reservationDate = getReservationDateValue(reservation);
      if (!reservationDate) {
        return false;
      }

      return formatDateForInput(reservationDate) === dateFilter;
    }
  );

  const totalPages =
    filteredReservations.length === 0
      ? 1
      : Math.ceil(filteredReservations.length / RESERVATIONS_PER_PAGE);

  const paginatedReservations = filteredReservations.slice(
    (currentPage - 1) * RESERVATIONS_PER_PAGE,
    currentPage * RESERVATIONS_PER_PAGE
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  // 获取格式化的日期显示
  const getDisplayDate = (reservation: Reservation): string => {
    // 优先使用displayDate字段
    if (reservation.displayDate) {
      return reservation.displayDate;
    }

    // 然后尝试使用bookingDate字段
    if (reservation.bookingDate instanceof Date) {
      const date = reservation.bookingDate;
      return `${date.getFullYear()}年${
        date.getMonth() + 1
      }月${date.getDate()}日`;
    }

    // 向后兼容：使用reservationDate字段
    if (reservation.reservationDate) {
      return reservation.reservationDate;
    }

    return "日付不明";
  };

  // 获取格式化的时间显示
  const getDisplayTime = (reservation: Reservation): string => {
    // 优先使用displayTimeRange字段
    if (reservation.displayTimeRange) {
      return reservation.displayTimeRange;
    }

    // 然后尝试使用startDateTime和endDateTime字段
    if (
      reservation.startDateTime instanceof Date &&
      reservation.endDateTime instanceof Date
    ) {
      const startTime = `${String(
        reservation.startDateTime.getHours()
      ).padStart(2, "0")}:${String(
        reservation.startDateTime.getMinutes()
      ).padStart(2, "0")}`;
      const endTime = `${String(reservation.endDateTime.getHours()).padStart(
        2,
        "0"
      )}:${String(reservation.endDateTime.getMinutes()).padStart(2, "0")}`;
      return `${startTime}～${endTime}`;
    }

    // 向后兼容：使用reservationTime字段
    if (reservation.reservationTime) {
      return reservation.reservationTime;
    }

    return "時間不明";
  };

  // 获取格式化的附加方案显示
  const getDisplayPlan = (reservation: Reservation): string => {
    // 如果有plan字段，优先使用
    if (reservation.plan) {
      return reservation.plan;
    }

    // 如果是慢房间套餐
    if (reservation.slowRoomAsSetPlan) {
      // 优先使用displaySlowRoomTimeRange
      if (reservation.displaySlowRoomTimeRange) {
        return `スロールーム (${reservation.displaySlowRoomTimeRange})`;
      }

      // 或者使用slowRoomStartDateTime和slowRoomEndDateTime
      if (
        reservation.slowRoomStartDateTime instanceof Date &&
        reservation.slowRoomEndDateTime instanceof Date
      ) {
        const startTime = `${String(
          reservation.slowRoomStartDateTime.getHours()
        ).padStart(2, "0")}:${String(
          reservation.slowRoomStartDateTime.getMinutes()
        ).padStart(2, "0")}`;
        const endTime = `${String(
          reservation.slowRoomEndDateTime.getHours()
        ).padStart(2, "0")}:${String(
          reservation.slowRoomEndDateTime.getMinutes()
        ).padStart(2, "0")}`;
        return `スロールーム (${startTime}～${endTime})`;
      }
    }

    return "なし";
  };

  const getDisplayReservationType = (reservation: Reservation): string => {
    if (typeof reservation.type === "string" && reservation.type.trim()) {
      return reservation.type;
    }

    if (
      typeof reservation.reservationType === "string" &&
      reservation.reservationType.trim()
    ) {
      return reservation.reservationType;
    }

    return reservation.roomType === "slow_room"
      ? "日帰り客室"
      : "サウナ";
  };

  const handleOpenReceiptModal = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsReceiptModalOpen(true);
  };

  const handleCloseReceiptModal = () => {
    setIsReceiptModalOpen(false);
    setReceiptName("");
    setSelectedReservation(null);
  };

  const handleIssueReceipt = () => {
    if (!receiptName.trim()) return;
    // TODO: 实现收据生成逻辑
    handleCloseReceiptModal();
  };

  const handleOpenCancelModal = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsCancelModalOpen(true);
  };

  const handleCloseCancelModal = () => {
    setIsCancelModalOpen(false);
    setSelectedReservation(null);
  };

  const handleCancelReservation = async () => {
    if (!selectedReservation || !user) return;

    setIsSubmitting(true);

    try {
      // 获取用户令牌
      const token = await user.getIdToken();
      
      // 调用取消API
      const response = await fetch(
        `/api/user/reservations/${selectedReservation.id}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // 检查请求是否成功
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "予約のキャンセルに失敗しました");
      }

      // 解析响应数据
      const responseData = await response.json();

      // 更新本地预约列表
      setReservations((prev) =>
        prev.map((res) =>
          res.id === selectedReservation.id
            ? { 
                ...res, 
                paymentStatus: "cancelled",
                // 保存退款信息
                refund: responseData.refund || null
              }
            : res
        )
      );

      // 关闭模态框
      handleCloseCancelModal();
      
      // 跳转到取消完成页面
      router.push("/reservations/cancel/complete");
    } catch (err) {
      console.error("Error cancelling reservation:", err);
      alert(
        err instanceof Error
          ? err.message
          : "予約のキャンセル中にエラーが発生しました"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 计算取消费用
  const calculateCancellationFee = (
    price: number,
    reservation: Reservation
  ) => {
    return getCancellationFeeAmount(price, reservation);
  };

  // 渲染收据模态框
  const renderReceiptModal = () => {
    if (!isMounted || !isReceiptModalOpen) return null;

    return createPortal(
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <div className="bg-white rounded-lg p-6 md:p-12 w-[95%] md:w-[90%] max-w-[920px] relative mx-auto my-4 max-h-[90vh] overflow-y-auto">
          <button
            onClick={handleCloseReceiptModal}
            className="absolute top-4 right-4 border border-white rounded-full px-3 py-1 text-sm tracking-[0.06em] font-zen-kaku-gothic flex items-center gap-2"
          >
            <span className="w-3 h-0.5 bg-[#444444] transform rotate-45 absolute"></span>
            <span className="w-3 h-0.5 bg-[#444444] transform -rotate-45 absolute"></span>
            <span className="ml-4">close</span>
          </button>

          <div className="space-y-6 md:space-y-8">
            <h2 className="text-lg md:text-2xl font-bold text-center text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              領収書の発行
            </h2>

            <div className="border border-[#BBBBBB] rounded px-3 py-2">
              <input
                type="text"
                value={receiptName}
                onChange={(e) => setReceiptName(e.target.value)}
                placeholder="領収書の宛名を入力してください。"
                className="w-full text-sm md:text-base text-[#444444] tracking-[0.06em] font-zen-kaku-gothic placeholder-[#444444] placeholder-opacity-50 outline-none"
              />
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleIssueReceipt}
                className="px-4 py-2 bg-[#444444] text-white rounded-full text-sm md:text-base tracking-[0.06em] font-zen-kaku-gothic"
              >
                領収書を発行する
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // 渲染取消预约模态框
  const renderCancelModal = () => {
    if (!isMounted || !isCancelModalOpen || !selectedReservation) return null;

    // 获取显示日期和时间
    const displayDate = getDisplayDate(selectedReservation);
    const displayTime = getDisplayTime(selectedReservation);
    const displayPlan = getDisplayPlan(selectedReservation);

    // 格式化价格（确保为数字）
    const price =
      typeof selectedReservation.price === "number"
        ? selectedReservation.price
        : parseInt(String(selectedReservation.price));

    const cancellationPolicyMessage = getCancellationPolicyMessage(
      selectedReservation
    );

    return createPortal(
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <div className="bg-white rounded-lg p-6 md:p-8 w-[95%] md:w-[90%] max-w-[920px] mx-auto my-4 max-h-[90vh] overflow-y-auto">
          <div className="space-y-4 md:space-y-6">
            <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
              <h2 className="text-lg md:text-2xl font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                予約キャンセル
              </h2>
            </div>

            <p className="text-sm md:text-base text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              以下の予約をキャンセルします。
            </p>

            <div className="bg-white rounded-lg p-4 md:p-8 space-y-6 md:space-y-8">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="w-28 md:w-32 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    予約日時
                  </span>
                  <span className="flex-1 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    {displayDate} {displayTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-28 md:w-32 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    予約種別
                  </span>
                  <span className="flex-1 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    {getDisplayReservationType(selectedReservation)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-28 md:w-32 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    お部屋
                  </span>
                  <span className="flex-1 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    {selectedReservation.roomTypeName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-28 md:w-32 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    セットプラン
                  </span>
                  <span className="flex-1 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    {displayPlan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-28 md:w-32 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    利用料金
                  </span>
                  <span className="flex-1 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    {price.toLocaleString()}円
                  </span>
                </div>
              </div>

              <div className="flex justify-center items-end gap-4 border-t border-[#BBBBBB] pt-4">
                <span className="text-sm md:text-base text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                  キャンセル料
                </span>
                <div className="flex items-baseline">
                  <span className="text-lg md:text-2xl font-bold text-[#E51D1D] tracking-[0.06em] font-zen-kaku-gothic">
                    {calculateCancellationFee(
                      price,
                      selectedReservation
                    ).toLocaleString()}
                  </span>
                  <span className="text-sm md:text-base font-bold text-[#E51D1D] tracking-[0.06em] font-zen-kaku-gothic ml-1">
                    円
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              {cancellationPolicyMessage}
              <br />
              お支払い済みのご利用料金からキャンセル料を差し引いた金額が返金されます。
            </p>

            <div className="flex justify-center gap-3 md:gap-4 mt-6 md:mt-8">
              <button
                onClick={handleCloseCancelModal}
                className="px-6 md:px-8 py-2 bg-[#999999] text-white rounded-full text-sm md:text-base tracking-[0.06em] font-zen-kaku-gothic"
                disabled={isSubmitting}
              >
                戻る
              </button>
              <button
                onClick={handleCancelReservation}
                className="px-6 md:px-8 py-2 bg-[#444444] text-white rounded-full text-sm md:text-base tracking-[0.06em] font-zen-kaku-gothic"
                disabled={isSubmitting}
              >
                {isSubmitting ? "処理中..." : "キャンセルする"}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // 未登录时显示登录提示
  if (!loading && !user) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 md:space-y-12">
        <div className="border-b border-[rgba(68,68,68,0.2)] pb-0">
          <div className="pb-[16px] md:pb-4">
            <h1 className="text-base md:text-2xl font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
              予約一覧
            </h1>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-sm md:text-base text-[#444444] tracking-[0.06em] font-zen-kaku-gothic mb-4">
            予約情報を表示するにはログインしてください。
          </p>
          <button
            onClick={() => router.push("/login?returnTo=/reservations")}
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-[0.06em] font-zen-kaku-gothic"
          >
            ログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12">
      <div className="border-b border-[rgba(68,68,68,0.2)] pb-0">
        <div className="pb-[16px] md:pb-4">
          <h1 className="text-base md:text-2xl font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
            予約一覧
          </h1>
        </div>
      </div>

      <div className="flex flex-row flex-wrap w-full gap-2 md:gap-4">
        <button
          className={`flex-1 min-w-[100px] md:min-w-0 md:flex-none px-4 md:px-6 py-1.5 md:py-2 rounded-full text-sm md:text-base font-bold md:font-normal tracking-[0.06em] font-zen-kaku-gothic text-center text-[#444444] ${
            activeTab === "current"
              ? "bg-[#F0EAE4] border border-[#444444]"
              : "bg-white border border-[#444444]"
          }`}
          onClick={() => setActiveTab("current")}
        >
          現在の予約
        </button>
        <button
          className={`flex-1 min-w-[100px] md:min-w-0 md:flex-none px-4 md:px-6 py-1.5 md:py-2 rounded-full text-sm md:text-base font-bold md:font-normal tracking-[0.06em] font-zen-kaku-gothic text-center text-[#444444] ${
            activeTab === "past"
              ? "bg-[#F0EAE4] border border-[#444444]"
              : "bg-white border border-[#444444]"
          }`}
          onClick={() => setActiveTab("past")}
        >
          過去の予約
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3">
          <label
            htmlFor="reservation-date-filter"
            className="text-sm md:text-base text-[#444444] tracking-[0.06em] font-zen-kaku-gothic"
          >
            日付で絞り込む
          </label>
          <input
            id="reservation-date-filter"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="min-w-[180px] md:min-w-[220px] px-4 py-2 border border-[#444444] rounded-full text-sm md:text-base text-[#444444] tracking-[0.06em] font-zen-kaku-gothic bg-white"
          />
        </div>
        {dateFilter && (
          <button
            onClick={() => setDateFilter("")}
            className="self-start md:self-auto px-4 md:px-6 py-1.5 md:py-2 rounded-full border border-[#444444] text-sm md:text-base text-[#444444] tracking-[0.06em] font-zen-kaku-gothic bg-white"
          >
            絞り込みをクリア
          </button>
        )}
      </div>

      {/* 加载状态 */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-sm md:text-base text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
            予約データを読み込み中...
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm md:text-base text-[#E51D1D] tracking-[0.06em] font-zen-kaku-gothic">
            {error}
          </p>
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-sm md:text-base text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
            {activeTab === "current"
              ? "現在予約されているデータはありません"
              : "過去の予約はありません"}
          </p>
        </div>
      ) : (
        <div className="space-y-6 md:space-y-8">
          {paginatedReservations.map((reservation) => (
            <div
              key={reservation.id}
              className="flex flex-col md:flex-row md:items-stretch md:gap-8"
            >
              <div className="w-full md:w-[240px] h-[200px] md:min-h-full relative rounded overflow-hidden md:flex-shrink-0">
                <Image
                  src={reservation.imageUrl || "/images/room.png"}
                  alt={reservation.roomTypeName}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 space-y-4 md:space-y-6 mt-4 md:mt-0">
                <div className="bg-white rounded-lg p-4 md:p-8 space-y-2">
                  <div className="flex justify-between">
                    <span className="w-28 md:w-32 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      予約日時
                    </span>
                    <span className="flex-1 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      {getDisplayDate(reservation)}{" "}
                      {getDisplayTime(reservation)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-28 md:w-32 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      予約種別
                    </span>
                    <span className="flex-1 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      {getDisplayReservationType(reservation)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-28 md:w-32 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      お部屋
                    </span>
                    <span className="flex-1 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      {reservation.roomTypeName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-28 md:w-32 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      セットプラン
                    </span>
                    <span className="flex-1 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      {getDisplayPlan(reservation)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-28 md:w-32 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      利用料金
                    </span>
                    <span className="flex-1 text-sm md:text-sm text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      {(typeof reservation.price === "number"
                        ? reservation.price
                        : parseInt(String(reservation.price))
                      ).toLocaleString()}
                      円
                    </span>
                  </div>
                </div>
                {reservation.paymentStatus === "paid" ? (
                  <div className="flex justify-end gap-2 md:gap-4">
                    {/* 只有未结束的预约才显示取消按钮 */}
                    {!isPastReservation(reservation) && (
                      <button
                        onClick={() => handleOpenCancelModal(reservation)}
                        className="px-3 md:px-4 py-1.5 md:py-2 bg-[#444444] text-white rounded-full text-sm md:text-sm tracking-[0.06em] font-zen-kaku-gothic"
                      >
                        予約キャンセル
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <span className="px-3 md:px-4 py-1.5 md:py-2 bg-[#BBBBBB] text-white rounded-full text-sm md:text-sm tracking-[0.06em] font-zen-kaku-gothic">
                      キャンセル済み
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="flex flex-col items-stretch md:flex-row md:items-center md:justify-between gap-3 md:gap-4 pt-2">
            <span className="text-base md:text-base text-[#444444] tracking-[0.06em] font-zen-kaku-gothic text-center md:text-left">
              ページ {currentPage} / {totalPages}
            </span>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={!canGoPrev}
                className={`w-full md:w-auto px-5 md:px-6 py-3 md:py-2 rounded-full border border-[#444444] text-base tracking-[0.06em] font-zen-kaku-gothic transition-colors ${
                  canGoPrev
                    ? "text-[#444444] bg-white hover:bg-[#F0EAE4]"
                    : "text-[#BBBBBB] bg-[#F5F5F5] cursor-not-allowed"
                }`}
              >
                前へ
              </button>
              <button
                onClick={handleNextPage}
                disabled={!canGoNext}
                className={`w-full md:w-auto px-5 md:px-6 py-3 md:py-2 rounded-full border border-[#444444] text-base tracking-[0.06em] font-zen-kaku-gothic transition-colors ${
                  canGoNext
                    ? "text-[#444444] bg-white hover:bg-[#F0EAE4]"
                    : "text-[#BBBBBB] bg-[#F5F5F5] cursor-not-allowed"
                }`}
              >
                次へ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 使用渲染函数代替内联JSX */}
      {renderReceiptModal()}
      {renderCancelModal()}
    </div>
  );
}
