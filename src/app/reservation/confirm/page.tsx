"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { auth } from "@/utils/firebase";
import { onAuthStateChange, getUserData } from "@/utils/auth";
import { User } from "firebase/auth";

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
  const [isNewUser, setIsNewUser] = useState(false);
  const [formErrors, setFormErrors] = useState({
    phone: false,
    birthdate: false,
    gender: false,
    fullName: false,
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  // 邮件验证相关状态
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [needResetPassword, setNeedResetPassword] = useState(false);
  const [resetPasswordUrl, setResetPasswordUrl] = useState("");
  const [checkingVerification, setCheckingVerification] = useState(false);

  // 添加一个状态用于强制刷新
  const [metadataRefreshTrigger, setMetadataRefreshTrigger] = useState(0);

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
            // 添加标志，指示是否是纯sauna房间类型
            isPureSaunaRoom: ["tototo", "fuuu", "zabuun", "toron"].includes(
              parsedInfo.selectedRoomType
            ),
            // 添加是否选择了slow room作为套餐
            hasSlowRoomPlan: parsedInfo.needSlowRoom,
          });
        }
      } catch (error) {
        console.error("Error parsing reservation info:", error);
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
              setIsNewUser(false);
              return;
            } else if (data.fullName) {
              // 如果有部分信息，保留已有信息，但仍视为新用户
              setUserInfo((prev) => ({
                ...prev,
                fullName: data.fullName || prev.fullName,
                phone: data.phone || prev.phone,
                birthdate: data.birthdate || prev.birthdate,
                gender: data.gender || prev.gender,
              }));
            }
          }

          // 如果没有元数据或信息不完整，认为是新用户
          setIsNewUser(true);

          // 如果用户有displayName，则预填充到姓名字段
          if (user.displayName && !userInfo.fullName) {
            setUserInfo((prev) => ({
              ...prev,
              fullName: user.displayName || "",
            }));
          }
        } catch (error) {
          console.error("Error fetching user info:", error);
          setIsNewUser(true);
        }
      };

      fetchUserInfo();
    }
  }, [user, metadataRefreshTrigger, userInfo.fullName]);

  // 处理用户信息输入变化
  const handleUserInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserInfo((prev) => ({
      ...prev,
      [name]: value,
    }));

    // 清除错误提示
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: false,
      }));
    }
  };

  // 验证表单
  const validateForm = () => {
    const errors = {
      phone: !userInfo.phone,
      birthdate: !userInfo.birthdate,
      gender: !userInfo.gender,
      fullName: !userInfo.fullName,
    };

    setFormErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  // 处理完成预约并跳转到Stripe支付页面
  const handleCompleteReservation = async () => {
    try {
      // 确保用户已登录
      if (!user) {
        alert("ログインが必要です。");
        router.push("/login?returnTo=/reservation/confirm");
        return;
      }

      setFormSubmitted(true);

      // 如果是新用户，验证表单
      if (isNewUser) {
        const isValid = validateForm();
        if (!isValid) {
          return;
        }
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
        amount: reservation.totalPrice,
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
      };

      // 如果是新用户，先保存用户信息
      if (isNewUser) {
        try {
          // 使用Firebase更新用户信息
          const { success, error } = await import("@/utils/auth").then(
            ({ updateUserData }) =>
              updateUserData(user.uid, {
                phone: userInfo.phone,
                birthdate: userInfo.birthdate,
                gender: userInfo.gender as "male" | "female" | "",
                fullName: userInfo.fullName,
              })
          );

          if (!success) {
            throw new Error(error || "ユーザー情報の保存に失敗しました");
          }
        } catch (error) {
          console.error("保存中のエラー:", error);
          alert(
            "ユーザー情報の保存中にエラーが発生しました。もう一度お試しください。"
          );
          return;
        }
      }

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

  // 处理重新发送验证邮件
  const handleResendVerification = async () => {
    try {
      setSendingEmail(true);
      setEmailError(null);

      // 调用Firebase重新发送验证邮件
      const { resendVerificationEmail } = await import("@/utils/auth");
      const { success, error } = await resendVerificationEmail();

      if (success) {
        alert("確認メールを再送信しました。メールをご確認ください。");
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
  }, [user, setCheckingVerification]);

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

  // 验证用户是否已登录
  if (!user) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic mb-4">
            予約を確認するにはログインしてください。
          </p>
          <a
            href="/login?returnTo=/reservation/confirm"
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
          >
            ログイン
          </a>
        </div>
      </Layout>
    );
  }

  // 检查用户邮箱是否已验证
  if (user && !user.emailVerified) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <h2 className="text-red-600 font-bold text-lg mb-2 font-zen-kaku-gothic">
              メールアドレスの確認が必要です
            </h2>
            <p className="text-gray-700 text-sm mb-4 font-zen-kaku-gothic">
              {user.email}{" "}
              宛に確認メールを送信しました。メール内のリンクをクリックして、アカウントを有効化してください。
            </p>
            <p className="text-gray-700 text-sm mb-4 font-zen-kaku-gothic">
              メールが届いていない場合は、迷惑メールフォルダをご確認いただくか、再送信してください。
            </p>

            {checkingVerification && (
              <p className="text-blue-600 text-sm mb-4 font-zen-kaku-gothic">
                メール認証状態を確認中...
              </p>
            )}

            {emailError && (
              <p className="text-red-600 text-sm mb-4 font-zen-kaku-gothic">
                {emailError}
              </p>
            )}

            {needResetPassword ? (
              <div className="space-y-3">
                <p className="text-gray-700 text-sm font-zen-kaku-gothic">
                  パスワードリセットを行うことでもメールアドレスの確認ができます：
                </p>
                <a
                  href={resetPasswordUrl}
                  className="px-4 py-2 bg-[#444444] text-white rounded-full text-sm font-zen-kaku-gothic hover:bg-[#333333] transition-colors inline-block"
                >
                  パスワードリセット
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleResendVerification}
                  disabled={sendingEmail}
                  className={`px-4 py-2 bg-[#444444] text-white rounded-full text-sm font-zen-kaku-gothic hover:bg-[#333333] transition-colors ${
                    sendingEmail ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {sendingEmail ? "送信中..." : "確認メールを再送信"}
                </button>

                <div className="mt-4">
                  <button
                    onClick={checkEmailVerification}
                    disabled={checkingVerification}
                    className="text-blue-600 underline text-sm hover:text-blue-800"
                  >
                    既にメール認証済みの場合はこちらをクリック
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 font-zen-kaku-gothic">
            メールアドレス確認後、再度このページにアクセスして予約を続行してください。
          </p>
        </div>
      </Layout>
    );
  }

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
            <p className="text-red-600 text-sm md:text-base font-zen-kaku-gothic">
              まだ予約は完了しておりません。
            </p>
            <p className="text-gray-700 text-sm md:text-base font-zen-kaku-gothic">
              以下の内容でご予約を行います。
            </p>
          </div>

          {/* Reservation Details */}
          <div className="space-y-3 md:space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 text-sm md:text-base">
              <div className="text-gray-700 font-medium font-zen-kaku-gothic md:font-normal">
                予約日時
              </div>
              <div className="col-span-1 md:col-span-2 text-gray-700 font-zen-kaku-gothic pl-4 md:pl-0">
                {reservation.date} {reservation.time}
              </div>

              <div className="text-gray-700 font-medium font-zen-kaku-gothic md:font-normal">
                予約種別
              </div>
              <div className="col-span-1 md:col-span-2 text-gray-700 font-zen-kaku-gothic pl-4 md:pl-0">
                {reservation.type}
              </div>

              <div className="text-gray-700 font-medium font-zen-kaku-gothic md:font-normal">
                お部屋
              </div>
              <div className="col-span-1 md:col-span-2 text-gray-700 font-zen-kaku-gothic pl-4 md:pl-0">
                {reservation.room}
              </div>

              <div className="text-gray-700 font-medium font-zen-kaku-gothic md:font-normal">
                セットプラン
              </div>
              <div className="col-span-1 md:col-span-2 text-gray-700 font-zen-kaku-gothic pl-4 md:pl-0">
                {reservation.plan}
              </div>

              <div className="text-gray-700 font-medium font-zen-kaku-gothic md:font-normal">
                利用料金
              </div>
              <div className="col-span-1 md:col-span-2 pl-4 md:pl-0">
                {/* 纯sauna房间类型(TOTOTO,FUUU,ZABUUN,TORON) */}
                {reservation.isPureSaunaRoom && (
                  <>
                    <div className="mb-1 font-zen-kaku-gothic text-sm md:text-base">
                      <span className="font-medium">サウナ料金: </span>
                      <span>{reservation.roomPrice.toLocaleString()}円</span>
                    </div>

                    {/* 如果选了slow room套餐 */}
                    {reservation.hasSlowRoomPlan &&
                      reservation.slowRoomPrice > 0 && (
                        <>
                          <div className="mb-1 font-zen-kaku-gothic text-sm md:text-base">
                            <span className="font-medium">
                              スロールーム料金:{" "}
                            </span>
                            <span>
                              {(
                                reservation.slowRoomPrice + 1000
                              ).toLocaleString()}
                              円
                            </span>
                          </div>

                          {/* 套餐折扣，只有纯sauna + slow room套餐才显示 */}
                          <div className="mb-1 font-zen-kaku-gothic text-sm md:text-base text-red-600">
                            <span className="font-medium">セット割引: </span>
                            <span>-1,000円</span>
                          </div>
                        </>
                      )}
                  </>
                )}

                {/* サウナスイート房间类型 */}
                {reservation.roomType === "sauna_suite" && (
                  <div className="mb-1 font-zen-kaku-gothic text-sm md:text-base">
                    <span className="font-medium">サウナスイート料金: </span>
                    <span>{reservation.totalPrice.toLocaleString()}円</span>
                  </div>
                )}

                {/* スロールーム房间类型 */}
                {reservation.roomType === "slow_room" && (
                  <div className="mb-1 font-zen-kaku-gothic text-sm md:text-base">
                    <span className="font-medium">スロールーム料金: </span>
                    <span>{reservation.totalPrice.toLocaleString()}円</span>
                  </div>
                )}

                <span className="font-bold text-red-600 text-lg md:text-xl font-zen-kaku-gothic">
                  合計: {reservation.totalPrice.toLocaleString()}円
                </span>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="space-y-3 md:space-y-4 bg-gray-50 py-3 md:py-4 px-0 md:px-0 rounded-md">
            <h2 className="font-bold text-gray-700 text-base md:text-lg font-zen-kaku-gothic">
              予約者情報
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 text-sm md:text-base">
              <div className="text-gray-700 font-medium font-zen-kaku-gothic md:font-normal">
                お名前
              </div>
              <div className="col-span-1 md:col-span-2 text-gray-700 font-zen-kaku-gothic pl-4 md:pl-0">
                {isNewUser
                  ? "未入力（以下で入力してください）"
                  : userInfo.fullName}
              </div>

              <div className="text-gray-700 font-medium font-zen-kaku-gothic md:font-normal">
                メールアドレス
              </div>
              <div className="col-span-1 md:col-span-2 text-gray-700 font-zen-kaku-gothic pl-4 md:pl-0">
                {user.email}
              </div>
            </div>

            {/* 新用户信息填写表单 */}
            {isNewUser && (
              <div className="mt-4 md:mt-6 border-t border-gray-200 pt-3 md:pt-4">
                <div className="mb-2 md:mb-3">
                  <h3 className="font-bold text-gray-700 text-base md:text-lg font-zen-kaku-gothic">
                    追加情報入力
                    <span className="text-red-500 ml-2 text-xs md:text-sm">
                      全ての項目が必須です
                    </span>
                  </h3>
                </div>
                <div className="space-y-3 max-w-lg">
                  {/* 姓名 */}
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-0">
                    <label
                      htmlFor="fullName"
                      className="block text-gray-700 w-full md:w-24 text-sm md:text-base md:flex-shrink-0 font-zen-kaku-gothic font-medium"
                    >
                      お名前
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="flex-grow max-w-full md:max-w-[200px]">
                      <input
                        id="fullName"
                        type="text"
                        name="fullName"
                        value={userInfo.fullName}
                        onChange={handleUserInfoChange}
                        className={`w-full border ${
                          formSubmitted && formErrors.fullName
                            ? "border-red-500"
                            : "border-gray-300"
                        } px-3 py-2 rounded-md text-gray-700 text-sm`}
                        placeholder="例: 山田 太郎"
                      />
                      {formSubmitted && formErrors.fullName && (
                        <p className="text-red-500 text-xs md:text-sm mt-0.5 font-zen-kaku-gothic">
                          お名前を入力してください
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 電話番号 */}
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-0">
                    <label
                      htmlFor="phone"
                      className="block text-gray-700 w-full md:w-24 text-sm md:text-base md:flex-shrink-0 font-zen-kaku-gothic font-medium"
                    >
                      電話番号
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="flex-grow max-w-full md:max-w-[200px]">
                      <input
                        id="phone"
                        type="tel"
                        name="phone"
                        value={userInfo.phone}
                        onChange={handleUserInfoChange}
                        className={`w-full border ${
                          formSubmitted && formErrors.phone
                            ? "border-red-500"
                            : "border-gray-300"
                        } px-3 py-2 rounded-md text-gray-700 text-sm`}
                        placeholder="例: 080-1234-5678"
                      />
                      {formSubmitted && formErrors.phone && (
                        <p className="text-red-500 text-xs md:text-sm mt-0.5 font-zen-kaku-gothic">
                          電話番号を入力してください
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 生年月日 */}
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-0">
                    <label
                      htmlFor="birthdate"
                      className="block text-gray-700 w-full md:w-24 text-sm md:text-base md:flex-shrink-0 font-zen-kaku-gothic font-medium"
                    >
                      生年月日
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="flex-grow max-w-full md:max-w-[200px]">
                      <input
                        id="birthdate"
                        type="date"
                        name="birthdate"
                        value={userInfo.birthdate}
                        onChange={handleUserInfoChange}
                        className={`w-full border ${
                          formSubmitted && formErrors.birthdate
                            ? "border-red-500"
                            : "border-gray-300"
                        } px-3 py-2 rounded-md text-gray-700 text-sm`}
                      />
                      {formSubmitted && formErrors.birthdate && (
                        <p className="text-red-500 text-xs md:text-sm mt-0.5 font-zen-kaku-gothic">
                          生年月日を入力してください
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 性別 */}
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-0">
                    <label className="block text-gray-700 w-full md:w-24 text-sm md:text-base md:flex-shrink-0 font-zen-kaku-gothic font-medium">
                      性別
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="flex-grow">
                      <div className="flex gap-6">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name="gender"
                            value="male"
                            checked={userInfo.gender === "male"}
                            onChange={handleUserInfoChange}
                            className="mr-1.5 h-4 w-4"
                          />
                          <span className="text-gray-700 text-sm md:text-base font-zen-kaku-gothic">
                            男性
                          </span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name="gender"
                            value="female"
                            checked={userInfo.gender === "female"}
                            onChange={handleUserInfoChange}
                            className="mr-1.5 h-4 w-4"
                          />
                          <span className="text-gray-700 text-sm md:text-base font-zen-kaku-gothic">
                            女性
                          </span>
                        </label>
                      </div>
                      {formSubmitted && formErrors.gender && (
                        <p className="text-red-500 text-xs md:text-sm mt-0.5 font-zen-kaku-gothic">
                          性別を選択してください
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cancellation Policy */}
          <div className="text-sm md:text-base text-gray-700 space-y-1 md:space-y-2 font-zen-kaku-gothic mt-2 md:mt-0">
            <p>予約キャンセルは、予約開始時間の48時間前まで無料で可能です。</p>
            <p>以降はキャンセル料100%がかかりますのでお気を付けください。</p>
            <p>
              （いかなる事情の場合も、キャンセル期限を過ぎますと所定のキャンセル料が発生いたします。
              <br className="hidden md:block" />
              あらかじめご了承ください。）
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4 pt-6 md:pt-8">
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
          </div>
        </div>
      </div>
    </Layout>
  );
}
