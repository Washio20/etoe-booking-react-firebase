"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Layout from "@/components/Layout";
import { auth } from "@/utils/firebase";
import { onAuthStateChange, getUserData } from "@/utils/auth";
import { User } from "firebase/auth";
import { Coupon } from "@/types/coupon";
import CouponSection from "@/components/CouponSection";
import { deleteTempReservationById } from "@/utils/tempReservation";

// 折扣详情接口
interface DiscountBreakdown {
  totalDiscount: number;
  roomDiscount: number;
  slowRoomDiscount: number;
  applicableItems: string[];
}

export default function ReservationConfirm() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reservation, setReservation] = useState({
    date: "2024年1月1日",
    time: "20:00〜22:00",
    type: "サウナ",
    room: "ROOM Sauna",
    roomType: "未選択",
    plan: "なし",
    price: "0,000",
    roomPrice: 0,
    slowRoomPrice: 0,
    totalPrice: 0,
    originalTotalPrice: 0, // 添加原始总价
    isPureSaunaRoom: false,
    hasSlowRoomPlan: false,
  });

  // 用户信息状态
  const [userInfo, setUserInfo] = useState({
    phone: "",
    birthdate: "",
    gender: "",
    fullName: "",
  });

  // 邮件验证相关状态
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(false);

  // 添加Dialog相关状态
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");

  // 添加一个状态用于强制刷新
  const [metadataRefreshTrigger, setMetadataRefreshTrigger] = useState(0);

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountBreakdown, setDiscountBreakdown] = useState<DiscountBreakdown | null>(null);
  const [showCouponSection, setShowCouponSection] = useState(false);

  // 兼容性：计算折扣金额（保留旧逻辑作为备用）
  const calculateDiscount = useCallback((coupon: any, originalPrice: number) => {
    if (!coupon) return 0;
    
    if (coupon.discountType === 'fixed') {
      // 固定金额折扣
      return Math.min(coupon.discountValue, originalPrice);
    } else {
      // 百分比折扣
      const discount = Math.floor(originalPrice * (coupon.discountValue / 100));
      // 如果有最大折扣限制
      if (coupon.maxDiscount) {
        return Math.min(discount, coupon.maxDiscount);
      }
      return discount;
    }
  }, []);

  // 处理应用优惠券
  const handleCouponApplied = useCallback((coupon: Coupon, breakdown?: DiscountBreakdown) => {
    setAppliedCoupon(coupon);
    
    if (breakdown) {
      setDiscountBreakdown(breakdown);
      
      // 更新价格显示
      setReservation(prev => ({
        ...prev,
        totalPrice: prev.originalTotalPrice - breakdown.totalDiscount,
      }));
    } else {
      // 兼容旧的计算方式
      const originalPrice = reservation.originalTotalPrice;
      const discount = calculateDiscount(coupon, originalPrice);
      setReservation(prev => ({
        ...prev,
        totalPrice: prev.originalTotalPrice - discount,
      }));
    }
  }, [reservation.originalTotalPrice, calculateDiscount]);

  // 处理移除优惠券
  const handleCouponRemoved = useCallback(() => {
    // 恢复原始价格
    setReservation(prev => ({
      ...prev,
      totalPrice: prev.originalTotalPrice,
    }));
    
    setAppliedCoupon(null);
    setDiscountBreakdown(null);
  }, []);

  // 监听Firebase认证状态
  useEffect(() => {
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 页面可见性变化时刷新用户元数据
  useEffect(() => {
    // 只在页面获得焦点时刷新数据
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // 页面可见时触发刷新
        setMetadataRefreshTrigger((prev) => prev + 1);
      }
    };

    // 监听页面可见性变化
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 从localStorage获取预约信息
  useEffect(() => {
    const storedInfo = localStorage.getItem("reservationInfo");
    if (storedInfo) {
      try {
        const parsedInfo = JSON.parse(storedInfo);

        // 设置预约信息
        if (parsedInfo) {
          // 格式化日期
          let formattedDate = "未選択";
          let displayDate = "未選択"; // 用于UI显示的日期
          let formattedTime = parsedInfo.selectedTime || "未選択";
          
          if (parsedInfo.selectedDate) {
            const date = new Date(parsedInfo.selectedDate);
            formattedDate = `${date.getFullYear()}年${
              date.getMonth() + 1
            }月${date.getDate()}日`;
            displayDate = formattedDate; // 默认显示日期与存储日期相同
            
            // 处理跨日期时间段
            if (parsedInfo.selectedTime) {
              const timeSlot = parsedInfo.selectedTime;
              
              // 检查是否为凌晨时间段（00:00-06:00开始的时间段）
              if (timeSlot.match(/^0[0-5]:/)) {
                // 如果是凌晨时间段，显示为次日日期
                const nextDay = new Date(date);
                nextDay.setDate(date.getDate() + 1);
                displayDate = `${nextDay.getFullYear()}年${
                  nextDay.getMonth() + 1
                }月${nextDay.getDate()}日`;
              } 
              // 检查是否为跨日时间段（23:00-23:59开始，结束时间在次日）
              else if (timeSlot.match(/^23:\d+/) && timeSlot.includes("〜")) {
                const parts = timeSlot.split("〜");
                if (parts.length === 2) {
                  const endTime = parts[1];
                  // 如果结束时间在00:00-06:00之间，则为跨日时间段
                  if (endTime.match(/^0[0-5]:/)) {
                    const nextDay = new Date(date);
                    nextDay.setDate(date.getDate() + 1);
                    
                    // 修改显示方式：不再在日期中表示跨日，而是修改时间显示格式
                    displayDate = formattedDate;
                    
                    // 格式化时间为"当日日期 开始时间〜次日日期 结束时间"
                    const startTime = parts[0].trim();
                    const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
                    const nextMonthDay = `${nextDay.getMonth() + 1}/${nextDay.getDate()}`;
                    
                    formattedTime = `${monthDay} ${startTime}〜${nextMonthDay} ${endTime}`;
                  }
                }
              }
            }
          }

          // 根据房间类型设置房间名称
          let roomName = "未選択";
          switch (parsedInfo.selectedRoomType) {
            case "tototo":
              roomName = "TOTOTO";
              break;
            case "fuuu":
              roomName = "FUUU";
              break;
            case "zabuun":
              roomName = "ZABUUN";
              break;
            case "toron":
              roomName = "TORON";
              break;
            case "sauna_suite":
              roomName = "サウナスイート";
              break;
            case "slow_room":
              roomName = "スロールーム";
              break;
            default:
              roomName = "未選択";
          }

          // 从API获取到的房间价格（通过localStorage传递）
          let roomPrice = 0;
          let slowRoomPrice = 0;
          let totalPrice = 0;

          // 获取房间价格
          if (parsedInfo.timeSlotPrice) {
            roomPrice = parsedInfo.timeSlotPrice;
          }

          // 根据房间类型处理价格
          if (parsedInfo.selectedRoomType === "slow_room") {
            // 如果是纯slow room，则只有一个价格
            totalPrice = roomPrice;
            slowRoomPrice = 0;
          } else if (parsedInfo.selectedRoomType === "sauna_suite") {
            // 如果是sauna_suite，则只有一个价格
            totalPrice = roomPrice;
            slowRoomPrice = 0;
          } else {
            // 如果是纯sauna房间类型，可能有额外的slow room价格
            if (parsedInfo.needSlowRoom && parsedInfo.slowRoomTimeRange) {
              slowRoomPrice = parsedInfo.slowRoomTimeRange.price;
              // 如果设置了套餐折扣（仅适用于纯sauna房间类型）
              slowRoomPrice -= 1000; // 套餐折扣¥1,000
              totalPrice = roomPrice + slowRoomPrice;
            } else {
              totalPrice = roomPrice;
            }
          }

          // 设置显示的预约信息
          setReservation({
            date: displayDate, // 使用处理过的日期显示
            time: formattedTime,
            type: "サウナ",
            room: roomName,
            roomType: parsedInfo.selectedRoomType,
            plan: parsedInfo.needSlowRoom
              ? `スロールーム (${
                  parsedInfo.slowRoomTimeRange
                    ? `${parsedInfo.slowRoomTimeRange.startTime}〜${parsedInfo.slowRoomTimeRange.endTime} / ${parsedInfo.slowRoomTimeRange.hours}時間`
                    : "時間未選択"
                })`
              : "なし",
            price: totalPrice.toLocaleString(), // 格式化价格显示
            roomPrice: roomPrice,
            slowRoomPrice: slowRoomPrice,
            totalPrice: totalPrice,
            originalTotalPrice: totalPrice, // 保存原始总价
            // 添加标志，指示是否是纯sauna房间类型
            isPureSaunaRoom: ["tototo", "fuuu", "zabuun", "toron"].includes(
              parsedInfo.selectedRoomType
            ),
            // 添加是否选择了slow room作为套餐
            hasSlowRoomPlan: parsedInfo.needSlowRoom,
          });
        }
      } catch (err) {
        console.error("解析预约信息时出错:", err);
      }
    } else {
      console.warn("No reservation info found in localStorage");
      router.push("/");
    }
  }, [router]);

  // 检查用户是否是新注册用户
  useEffect(() => {
    if (user) {
      // 从服务器获取用户信息
      const fetchUserInfo = async () => {
        try {
          // 使用Firebase获取用户元数据
          const { success, data } = await getUserData(user.uid);

          if (success && data) {
            // 如果用户元数据已经包含所需信息，视为老用户
            if (data.phone && data.birthdate && data.gender && data.fullName) {
              setUserInfo({
                phone: data.phone || "",
                birthdate: data.birthdate || "",
                gender: data.gender || "",
                fullName: data.fullName || "",
              });
              return;
            } else if (data.fullName) {
              // 如果有部分信息，保留已有信息
              setUserInfo((prev) => ({
                ...prev,
                fullName: data.fullName || prev.fullName,
                phone: data.phone || prev.phone,
                birthdate: data.birthdate || prev.birthdate,
                gender: data.gender || prev.gender,
              }));
            }
          }

          // 如果用户有displayName，则预填充到姓名字段
          if (user.displayName && !userInfo.fullName) {
            setUserInfo((prev) => ({
              ...prev,
              fullName: user.displayName || "",
            }));
          }
        } catch (error) {
          console.error("Error fetching user info:", error);
        }
      };

      fetchUserInfo();
    }
  }, [user, metadataRefreshTrigger, userInfo.fullName]);

  // 检查用户邮箱验证状态
  const checkEmailVerification = useCallback(async () => {
    if (!user) return;

    try {
      setCheckingVerification(true);

      // 使用Firebase检查邮箱验证状态
      const { checkEmailVerification } = await import("@/utils/auth");
      const isVerified = await checkEmailVerification();

      if (isVerified && user.emailVerified === false) {
        // 如果邮箱已验证但用户状态未更新，刷新用户
        await auth.currentUser?.reload();
        // 刷新页面获取最新状态
        window.location.reload();
      }
    } catch (error) {
      console.error("Error checking verification status:", error);
    } finally {
      setCheckingVerification(false);
    }
  }, [user]);

  // 定期检查邮箱验证状态
  useEffect(() => {
    if (user && !user.emailVerified) {
      // 立即检查一次
      checkEmailVerification();

      // 每30秒检查一次
      const interval = setInterval(checkEmailVerification, 30000);
      return () => clearInterval(interval);
    }
  }, [user, checkEmailVerification]);

  // 如果用户正在加载，显示加载状态
  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </Layout>
    );
  }

  // 处理重新发送验证邮件
  const handleResendVerification = async () => {
    try {
      setSendingEmail(true);
      setEmailError(null);

      // 调用Firebase重新发送验证邮件
      const { resendVerificationEmail } = await import("@/utils/auth");
      const { success, error } = await resendVerificationEmail();

      if (success) {
        // 替换alert为Dialog
        setDialogMessage("確認メールを再送信しました。メールをご確認ください。");
        setShowDialog(true);
      } else {
        setEmailError(
          error?.message ||
            "確認メールの再送信に失敗しました。もう一度お試しください。"
        );
      }
    } catch (error) {
      console.error("Error resending verification email:", error);
      setEmailError("確認メールの再送信中にエラーが発生しました。");
    } finally {
      setSendingEmail(false);
    }
  };

  // 处理完成预约并跳转到Stripe支付页面
  const handleCompleteReservation = async () => {
    try {
      // 确保用户已登录
      if (!user) {
        // 未登录用户不应该看到这个按钮，但以防万一
        alert("ログインが必要です。");
        router.push("/login?returnTo=/reservation/confirm");
        return;
      }

      // 检查用户邮箱是否已验证
      if (!user.emailVerified) {
        // 显示邮箱验证Dialog而不是跳转页面，提升用户体验
        setDialogMessage("予約を続行するには、メールアドレスの確認が必要です。確認用メールをご確認ください。");
        setShowDialog(true);
        return;
      }

      // 获取localStorage中的原始数据，用于提取needSlowRoom字段
      const storedInfo = localStorage.getItem("reservationInfo");
      let needSlowRoom = false;
      let slowRoomTimeRange = null;
      let selectedDate = null;
      let selectedTime = null;
      let roomType = '';

      if (storedInfo) {
        try {
          const parsedInfo = JSON.parse(storedInfo);
          needSlowRoom = parsedInfo.needSlowRoom;
          slowRoomTimeRange = parsedInfo.slowRoomTimeRange;
          selectedDate = parsedInfo.selectedDate; // ISO格式日期字符串
          selectedTime = parsedInfo.selectedTime; // 时间段字符串，例如"00:20〜01:50"
          roomType = parsedInfo.selectedRoomType;
        } catch (e) {
          console.error("解析localStorage中的预约数据时出错:", e);
        }
      }

      // 处理日期和时间
      let displayDate = reservation.date; // 用于显示的格式化日期
      let displayTimeRange = reservation.time; // 用于显示的时间范围
      let bookingDate = null; // 用于数据库的日期（预约当天的日期）
      let startDateTime = null; // 预约开始时间戳
      let endDateTime = null; // 预约结束时间戳

      if (selectedDate && selectedTime) {
        // 创建预约日期对象（选择的日期）
        const baseDate = new Date(selectedDate);
        
        // 解析时间段
        const timeSlotParts = selectedTime.split("〜");
        if (timeSlotParts.length === 2) {
          const startTimeStr = timeSlotParts[0].trim();
          const endTimeStr = timeSlotParts[1].trim();
          
          // 解析开始时间
          const [startHour, startMinute] = startTimeStr.split(":").map(Number);
          
          // 基准日期（预约的当天）
          bookingDate = new Date(baseDate);
          
          // 处理开始时间
          const startDate = new Date(baseDate);
          
          // 如果是凌晨时间段（00:00-06:00），则开始时间在次日
          if (startHour >= 0 && startHour < 6) {
            startDate.setDate(baseDate.getDate() + 1);
          }
          startDate.setHours(startHour, startMinute, 0, 0);
          startDateTime = startDate;
          
          // 处理结束时间
          const [endHour, endMinute] = endTimeStr.split(":").map(Number);
          const endDate = new Date(startDate); // 基于开始日期
          
          // 如果结束时间小于开始时间，或者开始时间是23点且结束时间是0-6点，说明跨日
          if (
            (endHour < startHour) || 
            (endHour === startHour && endMinute < startMinute) ||
            (startHour >= 23 && endHour >= 0 && endHour < 6)
          ) {
            endDate.setDate(endDate.getDate() + 1);
          }
          
          endDate.setHours(endHour, endMinute, 0, 0);
          endDateTime = endDate;
          
          // 为API准备显示用的格式化时间范围字符串
          // 检查是否为跨日时间段
          if (startHour >= 23 && (endHour >= 0 && endHour < 6)) {
            // 是跨日时间段，使用完整的日期+时间格式
            const startMonthDay = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
            const endMonthDay = `${endDate.getMonth() + 1}/${endDate.getDate()}`;
            displayTimeRange = `${startMonthDay} ${startTimeStr}〜${endMonthDay} ${endTimeStr}`;
          } else {
            // 不是跨日时间段，使用普通时间格式
            displayTimeRange = `${startTimeStr}〜${endTimeStr}`;
          }
        }
      }

      // 准备预约数据
      const reservationData = {
        date: reservation.date, // 显示用的日期字符串
        time: displayTimeRange, // 显示用的时间字符串（可能已格式化为包含日期的形式）
        room: reservation.room,
        roomType: reservation.roomType,
        plan: reservation.plan,
        needSlowRoom: needSlowRoom,
        slowRoomTimeRange: slowRoomTimeRange
          ? JSON.stringify(slowRoomTimeRange)
          : null,
        // 添加完整的日期和时间信息
        bookingDate: bookingDate ? bookingDate.toISOString() : null,
        startDateTime: startDateTime ? startDateTime.toISOString() : null,
        endDateTime: endDateTime ? endDateTime.toISOString() : null,
        displayDate: displayDate, // 用于UI显示的格式化日期
        displayTimeRange: displayTimeRange, // 用于UI显示的时间段（可能包含日期）

        // 添加优惠券信息
        couponId: appliedCoupon ? appliedCoupon.id : null,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        discountAmount: discountBreakdown ? discountBreakdown.totalDiscount : 0,
        
        // 优惠后的总价
        amount: reservation.totalPrice,

        // 添加折扣详情（新增）
        discountBreakdown: discountBreakdown ? {
          roomDiscount: discountBreakdown.roomDiscount,
          slowRoomDiscount: discountBreakdown.slowRoomDiscount,
          applicableItems: discountBreakdown.applicableItems
        } : null,
      };

      // 在控制台记录价格信息，用于调试
      console.log("预约价格信息:", {
        原始总价: reservation.originalTotalPrice,
        优惠券折扣: discountBreakdown ? discountBreakdown.totalDiscount : 0,
        最终价格: reservation.totalPrice,
        优惠券ID: appliedCoupon ? appliedCoupon.id : "未使用优惠券",
        折扣详情: discountBreakdown
      });

      // 获取当前用户的ID令牌
      const idToken = await user.getIdToken();

      // 调用API创建支付会话
      const response = await fetch("/api/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(reservationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "支払い処理中にエラーが発生しました"
        );
      }

      const { url } = await response.json();
      
      // 重定向到Stripe支付页面
      if (url) {
        // 保存预约信息到localStorage，支付成功后可以使用
        localStorage.setItem(
          "pendingReservation",
          JSON.stringify(reservationData)
        );
        
        // 此时可以清理临时预约信息，因为已经成功创建支付会话，临时数据已完成使命
        const reservationId = localStorage.getItem("reservationId");
        if (reservationId) {
          // 删除临时预约数据
          deleteTempReservationById(reservationId)
            .then(success => {
              if (success) {
                // 删除成功后，清除localStorage中的ID
                localStorage.removeItem("reservationId");
              }
            })
            .catch(error => {
              console.error("Failed to delete temporary reservation:", error);
            });
        }
        
        // 重定向到Stripe支付页面
        window.location.href = url;
      } else {
        throw new Error("支払いURLの取得に失敗しました");
      }
    } catch (error) {
      console.error("支払い処理中のエラー:", error);
      alert("決済処理中にエラーが発生しました。もう一度お試しください。");
    }
  };

  return (
    <Layout>
      <div className="max-w-[920px] mx-auto px-4 py-6 md:py-12">
        <div className="space-y-4 md:space-y-6">
          {/* Title */}
          <div className="border-b border-gray-300 pb-2 md:pb-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wider font-zen-kaku-gothic">
              予約確認
            </h1>
          </div>

          {/* Warning Message */}
          <div className="space-y-2 md:space-y-4">
            <p className="text-red-600 text-base md:text-lg font-zen-kaku-gothic">
              まだ予約は完了しておりません。
            </p>
            <p className="text-gray-700 text-base md:text-lg font-zen-kaku-gothic">
              以下の内容でご予約を行います。
            </p>
          </div>

          {/* Reservation Details */}
          <div className="bg-white rounded-md p-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 text-sm md:text-base">
              <div className="flex items-center">
                <div className="text-gray-700 font-bold font-zen-kaku-gothic w-24 md:w-28">
                  予約日時
                </div>
                <div className="text-gray-700 font-zen-kaku-gothic flex-1">
                  {reservation.date} {reservation.time}
                </div>
              </div>

              <div className="flex items-center">
                <div className="text-gray-700 font-bold font-zen-kaku-gothic w-24 md:w-28">
                  予約種別
                </div>
                <div className="text-gray-700 font-zen-kaku-gothic flex-1">
                  {reservation.type}
                </div>
              </div>

              <div className="flex items-center">
                <div className="text-gray-700 font-bold font-zen-kaku-gothic w-24 md:w-28">
                  お部屋
                </div>
                <div className="text-gray-700 font-zen-kaku-gothic flex-1">
                  {reservation.room}
                </div>
              </div>

              <div className="flex items-center">
                <div className="text-gray-700 font-bold font-zen-kaku-gothic w-24 md:w-28">
                  セットプラン
                </div>
                <div className="text-gray-700 font-zen-kaku-gothic flex-1">
                  {reservation.plan}
                </div>
              </div>
            </div>
            
            {/* 价格显示部分 */}
            <div className="mt-4">
              <h3 className="font-bold text-gray-700 font-zen-kaku-gothic">利用料金</h3>
              <div className="py-4 px-0">
                <div className="flex flex-col gap-2 max-w-md">
                  {/* 纯sauna房间类型(TOTOTO,FUUU,ZABUUN,TORON) */}
                  {reservation.isPureSaunaRoom && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-zen-kaku-gothic text-sm md:text-base">サウナ料金</span>
                      <span className=" text-gray-800 font-zen-kaku-gothic">{reservation.roomPrice.toLocaleString()}円</span>
                    </div>
                  )}
                  
                  {/* サウナスイート房间类型 */}
                  {reservation.roomType === "sauna_suite" && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-zen-kaku-gothic text-sm md:text-base">サウナスイート料金</span>
                      <span className=" text-gray-800 font-zen-kaku-gothic">{reservation.roomPrice.toLocaleString()}円</span>
                    </div>
                  )}

                  {/* スロールーム房间类型 */}
                  {reservation.roomType === "slow_room" && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-zen-kaku-gothic text-sm md:text-base">スロールーム料金</span>
                      <span className=" text-gray-800 font-zen-kaku-gothic">{reservation.roomPrice.toLocaleString()}円</span>
                    </div>
                  )}
                  
                  {/* 如果有慢房间 */}
                  {reservation.hasSlowRoomPlan && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-zen-kaku-gothic text-sm md:text-base">スロールーム</span>
                      <span className=" text-gray-800 font-zen-kaku-gothic">{(reservation.slowRoomPrice + 1000).toLocaleString()}円</span>
                    </div>
                  )}
                  
                  {/* 如果有套餐折扣 */}
                  {reservation.hasSlowRoomPlan && (
                    <div className="flex justify-between items-center">
                      <span className="text-red-600 font-zen-kaku-gothic text-sm md:text-base">セット割引</span>
                      <span className=" text-red-600 font-zen-kaku-gothic">-1,000円</span>
                    </div>
                  )}
                  
                  {/* 如果有优惠券折扣 - 显示详细的折扣分解 */}
                  {discountBreakdown && discountBreakdown.totalDiscount > 0 && (
                    <>
                      {discountBreakdown.roomDiscount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-red-600 font-zen-kaku-gothic text-sm md:text-base">
                            クーポン割引({getRoomTypeDisplayName(reservation.roomType)})
                          </span>
                          <span className=" text-red-600 font-zen-kaku-gothic">-{discountBreakdown.roomDiscount.toLocaleString()}円</span>
                        </div>
                      )}
                      {discountBreakdown.slowRoomDiscount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-red-600 font-zen-kaku-gothic text-sm md:text-base">
                            クーポン割引(スロールーム)
                          </span>
                          <span className=" text-red-600 font-zen-kaku-gothic">-{discountBreakdown.slowRoomDiscount.toLocaleString()}円</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* 合计 */}
                  <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-300">
                    <span className="font-bold text-red-600 font-zen-kaku-gothic text-base">合計</span>
                    <span className="font-bold text-red-600 font-zen-kaku-gothic text-base">{reservation.totalPrice.toLocaleString()}円</span>
                  </div>
                </div>
                
                {/* 在价格区域内显示优惠券按钮 */}
                {!appliedCoupon && (
                  <div className="mt-4 flex justify-start">
                    <button
                      onClick={() => setShowCouponSection(!showCouponSection)}
                      className="text-blue-600 text-sm underline hover:text-blue-800 font-zen-kaku-gothic"
                    >
                      {showCouponSection ? "クーポン入力を隠す" : "クーポンを使用する"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 优惠券部分 - 改善布局 */}
          {showCouponSection && (
            <div className="mt-3 md:mt-4">
              <CouponSection 
                onCouponApplied={handleCouponApplied}
                onCouponRemoved={handleCouponRemoved}
                reservationData={{
                  roomType: reservation.roomType,
                  roomPrice: reservation.roomPrice,
                  slowRoomPrice: reservation.slowRoomPrice,
                  hasSlowRoomPlan: reservation.hasSlowRoomPlan
                }}
              />
            </div>
          )}

          {/* User Information */}
          <div className="space-y-3 md:space-y-4 py-3 md:py-4 px-0 md:px-0 rounded-md">
            <h2 className="font-bold text-gray-700 text-base md:text-lg font-zen-kaku-gothic">
              予約者情報
            </h2>
            <div className="bg-white p-6 rounded-md">
              {user ? (
                <div className="grid grid-cols-1 gap-4 text-sm md:text-base">
                  <div className="flex items-center">
                    <div className="text-gray-700 font-bold font-zen-kaku-gothic w-32 md:w-36">
                      お名前
                    </div>
                    <div className="text-gray-700 font-zen-kaku-gothic flex-1">
                      {userInfo.fullName}
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="text-gray-700 font-bold font-zen-kaku-gothic w-32 md:w-36">
                      メールアドレス
                    </div>
                    <div className="text-gray-700 font-zen-kaku-gothic flex-1">
                      {user.email}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-700 font-zen-kaku-gothic mb-6">
                  ご予約には会員登録が必要です。
                  </p>
                
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                    <Link
                      href="/register?returnTo=/reservation/confirm"
                      className="px-6 md:px-12 py-2 md:py-3 text-sm md:text-base font-medium text-[#444444] bg-white border border-[#444444] rounded-full hover:bg-gray-100 font-zen-kaku-gothic inline-block min-w-[12rem] whitespace-nowrap"
                    >
                      新規会員登録
                    </Link>
                    <Link
                      href="/login?returnTo=/reservation/confirm"
                      className="px-6 md:px-12 py-2 md:py-3 text-sm md:text-base font-medium text-white bg-[#444444] rounded-full hover:bg-[#333333] font-zen-kaku-gothic inline-block min-w-[12rem] whitespace-nowrap"
                    >
                      ログイン
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cancellation Policy */}
          {user && (
          <div className="text-sm md:text-base text-gray-700 space-y-1 md:space-y-2 font-zen-kaku-gothic mt-2 md:mt-0">
            <p>予約キャンセルは、予約開始時間の48時間前まで無料で可能です。</p>
            <p>以降はキャンセル料100%がかかりますのでお気を付けください。</p>
            <p>
              （いかなる事情の場合も、キャンセル期限を過ぎますと所定のキャンセル料が発生いたします。
              <br className="hidden md:block" />
              あらかじめご了承ください。）
            </p>
          </div>
          )}

          <div className="flex justify-center space-x-4 pt-6 md:pt-8">
            {user && (
              // 已登录用户显示"戻る"和"次へ進む"按钮
              <>
                <button
                  onClick={() => router.push("/")}
                  className="px-6 md:px-12 py-2 md:py-3 text-sm md:text-base font-medium text-white bg-gray-600 rounded-full hover:bg-gray-700 font-zen-kaku-gothic"
                >
                  戻る
                </button>
                <button
                  onClick={handleCompleteReservation}
                  className="px-6 md:px-12 py-2 md:py-3 text-sm md:text-base font-medium text-white bg-gray-700 rounded-full hover:bg-gray-800 font-zen-kaku-gothic"
                >
                  次へ進む
                </button>
              </>
            )}
          </div>
        </div>

        {/* 添加Dialog组件 */}
        {showDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm md:max-w-md mx-auto">
              {dialogMessage.includes("予約を続行するには") ? (
                <>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 font-zen-kaku-gothic">メールアドレスの確認が必要です</h3>
                  <p className="text-gray-700 mb-4 font-zen-kaku-gothic">{user?.email} 宛に確認メールを送信しました。</p>
                  <p className="text-gray-700 mb-4 font-zen-kaku-gothic">メール内のリンクをクリックして、アカウントを有効化してください。</p>
                  
                  {sendingEmail ? (
                    <p className="text-blue-600 text-sm mb-4 font-zen-kaku-gothic">
                      メールを送信中...
                    </p>
                  ) : emailError ? (
                    <p className="text-red-600 text-sm mb-4 font-zen-kaku-gothic">
                      {emailError}
                    </p>
                  ) : null}
                  
                  <div className="flex flex-col md:flex-row justify-center space-y-2 md:space-y-0 md:space-x-4 mt-3">
                    <button
                      onClick={handleResendVerification}
                      disabled={sendingEmail}
                      className={`px-4 py-2 text-white bg-blue-600 rounded-full text-sm font-zen-kaku-gothic hover:bg-blue-700 transition-colors ${
                        sendingEmail ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      確認メールを再送信
                    </button>
                    <button
                      onClick={() => setShowDialog(false)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-full text-sm font-zen-kaku-gothic hover:bg-gray-800 transition-colors"
                    >
                      閉じる
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-700 mb-6 font-zen-kaku-gothic">{dialogMessage}</p>
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowDialog(false)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-full text-sm font-zen-kaku-gothic hover:bg-gray-800 transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );

  // 获取房间类型显示名称的辅助函数
  function getRoomTypeDisplayName(roomType: string): string {
    switch (roomType) {
      case 'tototo': return 'TOTOTO';
      case 'fuuu': return 'FUUU';
      case 'zabuun': return 'ZABUUN';
      case 'toron': return 'TORON';
      case 'sauna_suite': return 'サウナスイート';
      case 'slow_room': return 'スロールーム';
      default: return roomType;
    }
  }
}