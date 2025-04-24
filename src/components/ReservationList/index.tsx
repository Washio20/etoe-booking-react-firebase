// src\components\ReservationList\index.tsx

"use client";

import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
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

  // 房间图片映射
  const roomImages = useMemo<Record<string, string>>(
    () => ({
      tototo: "/images/tototo.jpeg",
      fuuu: "/images/fuuu.jpeg",
      zabuun: "/images/zabuun.jpeg",
      toron: "/images/toron.jpeg",
      sauna_suite: "/images/suite.jpeg",
      slow_room: "/images/slow-room.jpeg",
      // 默认图片
      default: "/images/room.png",
    }),
    []
  );

  // 确保只在客户端渲染模态框
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 获取用户的预约数据
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
        // 添加图片URL到每个预约记录
        const enhancedReservations = data.reservations.map(
          (res: Reservation) => {
            // 添加图片URL
            return {
              ...res,
              imageUrl: roomImages[res.roomType] || roomImages.default,
            };
          }
        );

        setReservations(enhancedReservations);
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
  }, [user, roomImages]);

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
  const filteredReservations = getFilteredReservations();

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
      // 记录取消时当前的预约信息，便于调试
      const isFree = canCancelForFree(selectedReservation);
      // console.log("取消预约:", {
      //   reservationId: selectedReservation.id,
      //   isFreeCancel: isFree,
      //   calculatedFee: calculateCancellationFee(
      //     typeof selectedReservation.price === "number"
      //       ? selectedReservation.price
      //       : parseInt(String(selectedReservation.price)),
      //     selectedReservation
      //   ),
      //   startDateTime: selectedReservation.startDateTime instanceof Date 
      //     ? selectedReservation.startDateTime.toLocaleString() 
      //     : '非Date对象',
      //   displayDate: selectedReservation.displayDate,
      //   displayTimeRange: selectedReservation.displayTimeRange
      // });

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
      // console.log("取消预约响应:", responseData);

      // 检查退款信息
      // if (isFree && (!responseData.refund || responseData.refund.amount <= 0)) {
      //   console.warn("警告: 预期免费取消但返回的退款金额为0或无退款信息", responseData);
      //   // 仍然继续处理，但记录这个问题
      // }

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

  // 判断是否可以免费取消（预约开始时间的48小时前）
  const canCancelForFree = (reservation: Reservation) => {
    try {
      const now = new Date(); // 当前时间
      let reservationStartTime: Date | null = null;
      
      // 1. 尝试使用startDateTime字段（Date对象）
      if (reservation.startDateTime instanceof Date) {
        reservationStartTime = reservation.startDateTime;
      }
      // 2. 尝试处理Firestore Timestamp对象
      else if (reservation.startDateTime && typeof reservation.startDateTime === 'object') {
        const startDateTime = reservation.startDateTime as any;
        
        // 有toDate方法的对象
        if (typeof startDateTime.toDate === 'function') {
          reservationStartTime = startDateTime.toDate();
        }
        // 原始Firestore时间戳
        else if (startDateTime._seconds !== undefined) {
          reservationStartTime = new Date(startDateTime._seconds * 1000);
        }
      }
      // 3. 尝试从displayDate和displayTimeRange解析
      else if (reservation.displayDate && reservation.displayTimeRange) {
        // 日期格式: YYYY年MM月DD日
        const dateMatch = reservation.displayDate.match(/(\d+)年(\d+)月(\d+)日/);
        if (dateMatch) {
          const [_, year, month, day] = dateMatch;
          
          // 时间格式: HH:MM～HH:MM
          const timeMatch = reservation.displayTimeRange.match(/(\d+):(\d+)/);
          if (timeMatch) {
            const [__, startHour, startMinute] = timeMatch;
            
            reservationStartTime = new Date(
              parseInt(year),
              parseInt(month) - 1, // 月份从0开始
              parseInt(day),
              parseInt(startHour),
              parseInt(startMinute)
            );
          }
        }
      }
      
      // 如果成功获取了预约开始时间，计算时间差
      if (reservationStartTime) {
        // 记录调试信息
        // console.log(`当前时间: ${now.toLocaleString()}`);
        // console.log(`预约时间: ${reservationStartTime.toLocaleString()}`);
        
        // 计算时间差（毫秒）
        const timeDifference = reservationStartTime.getTime() - now.getTime();
        // 转换为小时
        const hoursBeforeReservation = timeDifference / (1000 * 60 * 60);
        
        // console.log(`距离预约还有: ${hoursBeforeReservation.toFixed(2)} 小时`);
        
        // 48小时以上可以免费取消
        return hoursBeforeReservation >= 48;
      }
    } catch (error) {
      console.error("计算是否可免费取消时出错:", error);
    }
    
    // 默认情况：无法确定是否可以免费取消，安全起见返回false
    return false;
  };

  // 计算取消费用
  const calculateCancellationFee = (
    price: number,
    reservation: Reservation
  ) => {
    // 如果可以免费取消，返回0
    if (canCancelForFree(reservation)) {
      return 0;
    }
    // 否则收取100%取消费
    return price;
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
            className="absolute top-4 right-4 border border-white rounded-full px-3 py-1 text-[12px] tracking-[0.06em] font-zen-kaku-gothic flex items-center gap-2"
          >
            <span className="w-3 h-0.5 bg-[#444444] transform rotate-45 absolute"></span>
            <span className="w-3 h-0.5 bg-[#444444] transform -rotate-45 absolute"></span>
            <span className="ml-4">close</span>
          </button>

          <div className="space-y-6 md:space-y-8">
            <h2 className="text-[20px] md:text-[24px] font-bold text-center text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              領収書の発行
            </h2>

            <div className="border border-[#BBBBBB] rounded px-3 py-2">
              <input
                type="text"
                value={receiptName}
                onChange={(e) => setReceiptName(e.target.value)}
                placeholder="領収書の宛名を入力してください。"
                className="w-full text-[14px] md:text-[16px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic placeholder-[#444444] placeholder-opacity-50 outline-none"
              />
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleIssueReceipt}
                className="px-4 py-2 bg-[#444444] text-white rounded-full text-[14px] tracking-[0.06em] font-zen-kaku-gothic"
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

    // 判断是否可以免费取消
    const isFreeCancel = canCancelForFree(selectedReservation);

    return createPortal(
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <div className="bg-white rounded-lg p-6 md:p-8 md:p-12 w-[95%] md:w-[90%] max-w-[920px] mx-auto my-4 max-h-[90vh] overflow-y-auto">
          <div className="space-y-4 md:space-y-6">
            <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
              <h2 className="text-[20px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                予約キャンセル
              </h2>
            </div>

            <p className="text-[14px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              以下の予約をキャンセルします。
            </p>

            <div className="bg-white rounded-lg p-4 md:p-8 space-y-6 md:space-y-8">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="w-28 md:w-32 text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    予約日時
                  </span>
                  <span className="flex-1 text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    {displayDate} {displayTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-28 md:w-32 text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    予約種別
                  </span>
                  <span className="flex-1 text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    サウナ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-28 md:w-32 text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    お部屋
                  </span>
                  <span className="flex-1 text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    {selectedReservation.roomTypeName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-28 md:w-32 text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    セットプラン
                  </span>
                  <span className="flex-1 text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    {displayPlan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-28 md:w-32 text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    利用料金
                  </span>
                  <span className="flex-1 text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                    {price.toLocaleString()}円
                  </span>
                </div>
              </div>

              <div className="flex justify-center items-end gap-4 border-t border-[#BBBBBB] pt-4">
                <span className="text-[13px] md:text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                  キャンセル料
                </span>
                <div className="flex items-baseline">
                  <span className="text-[20px] md:text-[24px] font-bold text-[#E51D1D] tracking-[0.06em] font-zen-kaku-gothic">
                    {calculateCancellationFee(
                      price,
                      selectedReservation
                    ).toLocaleString()}
                  </span>
                  <span className="text-[13px] md:text-[15px] font-bold text-[#E51D1D] tracking-[0.06em] font-zen-kaku-gothic ml-1">
                    円
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              {isFreeCancel
                ? "予約開始時間の48時間前なので、キャンセル料はかかりません。"
                : "予約開始時間の48時間を過ぎているため、100%のキャンセル料がかかります。"}
              <br />
              お支払い済みのご利用料金からキャンセル料を差し引いた金額が返金されます。
            </p>

            <div className="flex justify-center gap-3 md:gap-4 mt-6 md:mt-8">
              <button
                onClick={handleCloseCancelModal}
                className="px-6 md:px-8 py-2 bg-[#999999] text-white rounded-full text-[14px] md:text-[16px] tracking-[0.06em] font-zen-kaku-gothic"
                disabled={isSubmitting}
              >
                戻る
              </button>
              <button
                onClick={handleCancelReservation}
                className="px-6 md:px-8 py-2 bg-[#444444] text-white rounded-full text-[14px] md:text-[16px] tracking-[0.06em] font-zen-kaku-gothic"
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
            <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
              予約一覧
            </h1>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-[14px] md:text-[16px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic mb-4">
            予約情報を表示するにはログインしてください。
          </p>
          <button
            onClick={() => router.push("/login?returnTo=/reservations")}
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-[14px] tracking-[0.06em] font-zen-kaku-gothic"
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
          <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
            予約一覧
          </h1>
        </div>
      </div>

      <div className="flex flex-row flex-wrap w-full gap-2 md:gap-4">
        <button
          className={`flex-1 min-w-[100px] md:min-w-0 md:flex-none px-4 md:px-6 py-1.5 md:py-2 rounded-full text-[13px] md:text-[16px] font-bold md:font-normal tracking-[0.06em] font-zen-kaku-gothic text-center ${
            activeTab === "current"
              ? "bg-[#F0EAE4] border border-[#444444]"
              : "bg-white border border-[#444444]"
          }`}
          onClick={() => setActiveTab("current")}
        >
          現在の予約
        </button>
        <button
          className={`flex-1 min-w-[100px] md:min-w-0 md:flex-none px-4 md:px-6 py-1.5 md:py-2 rounded-full text-[13px] md:text-[16px] font-bold md:font-normal tracking-[0.06em] font-zen-kaku-gothic text-center ${
            activeTab === "past"
              ? "bg-[#F0EAE4] border border-[#444444]"
              : "bg-white border border-[#444444]"
          }`}
          onClick={() => setActiveTab("past")}
        >
          過去の予約
        </button>
      </div>

      {/* 加载状态 */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-[14px] md:text-[16px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
            予約データを読み込み中...
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-[14px] md:text-[16px] text-[#E51D1D] tracking-[0.06em] font-zen-kaku-gothic">
            {error}
          </p>
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-[14px] md:text-[16px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
            {activeTab === "current"
              ? "現在予約されているデータはありません"
              : "過去の予約はありません"}
          </p>
        </div>
      ) : (
        <div className="space-y-6 md:space-y-8">
          {filteredReservations.map((reservation) => (
            <div
              key={reservation.id}
              className="flex flex-col md:flex-row md:items-start md:gap-8"
            >
              <div className="w-full md:w-[240px] h-[180px] relative rounded overflow-hidden">
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
                    <span className="w-28 md:w-32 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      予約日時
                    </span>
                    <span className="flex-1 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      {getDisplayDate(reservation)}{" "}
                      {getDisplayTime(reservation)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-28 md:w-32 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      予約種別
                    </span>
                    <span className="flex-1 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      サウナ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-28 md:w-32 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      お部屋
                    </span>
                    <span className="flex-1 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      {reservation.roomTypeName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-28 md:w-32 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      セットプラン
                    </span>
                    <span className="flex-1 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      {getDisplayPlan(reservation)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-28 md:w-32 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                      利用料金
                    </span>
                    <span className="flex-1 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
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
                    {/* <button
                      onClick={() => handleOpenReceiptModal(reservation)}
                      className="px-3 md:px-4 py-1.5 md:py-2 bg-[#444444] text-white rounded-full text-[10px] md:text-[12px] tracking-[0.06em] font-zen-kaku-gothic"
                    >
                      領収書の発行
                    </button> */}
                    {/* 只有未结束的预约才显示取消按钮 */}
                    {!isPastReservation(reservation) && (
                      <button
                        onClick={() => handleOpenCancelModal(reservation)}
                        className="px-3 md:px-4 py-1.5 md:py-2 bg-[#444444] text-white rounded-full text-[10px] md:text-[12px] tracking-[0.06em] font-zen-kaku-gothic"
                      >
                        予約キャンセル
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <span className="px-3 md:px-4 py-1.5 md:py-2 bg-[#BBBBBB] text-white rounded-full text-[10px] md:text-[12px] tracking-[0.06em] font-zen-kaku-gothic">
                      キャンセル済み
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 使用渲染函数代替内联JSX */}
      {renderReceiptModal()}
      {renderCancelModal()}
    </div>
  );
}
