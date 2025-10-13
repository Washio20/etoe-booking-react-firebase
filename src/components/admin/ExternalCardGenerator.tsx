"use client";

import { useState, useEffect } from "react";
import {
  SAUNA_ROOM_MAPPING,
  SUITE_ROOM_MAPPING,
  SLOW_ROOM_MAPPING,
} from "@/types/room";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Image from "next/image";

// 获取所有房间映射的合并列表
const getRoomOptions = () => {
  const allRooms: { [roomId: string]: string } = {};

  // 添加Sauna房间
  Object.entries(SAUNA_ROOM_MAPPING).forEach(([type, rooms]) => {
    rooms.forEach((roomId) => {
      allRooms[roomId] = `${roomId.replace(
        "room_",
        ""
      )} (${type.toUpperCase()})`;
    });
  });

  // 添加Suite房间
  Object.entries(SUITE_ROOM_MAPPING).forEach(([type, rooms]) => {
    rooms.forEach((roomId) => {
      allRooms[roomId] = `${roomId.replace("room_", "")} (サウナスイート)`;
    });
  });

  // 添加Slow房间
  Object.entries(SLOW_ROOM_MAPPING).forEach(([type, rooms]) => {
    rooms.forEach((roomId) => {
      allRooms[roomId] = `${roomId.replace("room_", "")} (スロールーム)`;
    });
  });

  return allRooms;
};

export default function ExternalCardGenerator() {
  // 获取当前用户
  const [user] = useAuthState(auth);

  // 表单状态
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("12:00");
  const [roomId, setRoomId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedCard, setGeneratedCard] = useState<any>(null);
  const [emailSent, setEmailSent] = useState<boolean>(false);
  type EmailLanguage = "ja" | "en" | "ja_day" | null;
  const [emailLanguage, setEmailLanguage] = useState<EmailLanguage>(null);

  // 房间选项
  const roomOptions = getRoomOptions();

  // 生成今天和明天的日期
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // 格式化日期为YYYY-MM-DD
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setStartDate(formatDate(today));
    setEndDate(formatDate(today));
  }, []);

  // 表单验证
  const validateForm = () => {
    if (!startDate) return "開始日を選択してください";
    if (!startTime) return "開始時間を選択してください";
    if (!endDate) return "終了日を選択してください";
    if (!endTime) return "終了時間を選択してください";
    if (!roomId) return "部屋を選択してください";
    if (!userName) return "お名前を入力してください";
    if (!userEmail) return "メールアドレスを入力してください";
    
    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) return "有効なメールアドレスを入力してください";

    // 检查开始时间是否早于结束时间
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    if (start >= end) return "開始時間は終了時間より前である必要があります";

    return null;
  };

  // 处理生成卡片
  const handleGenerateCard = async () => {
    // 表单验证
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }

    setFormError(null);
    setIsGenerating(true);
    setEmailSent(false);

    try {
      // 准备请求数据
      // 注意：这些字符串已经是本地时间（日本时间）
      // 直接创建日期对象会被解释为本地时区
      // 需要明确指定这是日本时间（UTC+9）
      const japanOffset = "+09:00";

      // 将表单时间转换为ISO格式的日本时间字符串
      const formattedStartTime = `${startDate}T${startTime}:00.000${japanOffset}`;
      const formattedEndTime = `${endDate}T${endTime}:00.000${japanOffset}`;

      // 创建随机预约ID
      const reservationId = `external_${Date.now()}`;

      // 获取当前用户的ID令牌
      const idToken = await user?.getIdToken();
      if (!idToken) {
        throw new Error("認証情報を取得できませんでした");
      }

      // 调用API生成卡片
      const response = await fetch("/api/admin/generate-external-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          physicalRoomId: roomId,
          reservationId,
          userName,
          userEmail,
          startDateTime: formattedStartTime,
          endDateTime: formattedEndTime,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "カード生成に失敗しました");
      }

      const data = await response.json();
      setGeneratedCard(data.card);
      // 不再自动发送邮件，改为手动选择语言发送
    } catch (error) {
      console.error("Error generating card:", error);
      setFormError(
        error instanceof Error
          ? error.message
          : "カード生成中にエラーが発生しました"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // 发送卡片邮件
  const sendCardEmail = async (
    reservationId: string,
    language: "ja" | "en",
    variant: "standard" | "daytrip" = "standard"
  ) => {
    setIsSendingEmail(true);
    setEmailLanguage(variant === "daytrip" ? "ja_day" : language);
    try {
      // 获取当前用户的ID令牌
      const idToken = await user?.getIdToken();
      if (!idToken) {
        throw new Error("認証情報を取得できませんでした");
      }

      // 调用发送邮件API
      const response = await fetch("/api/admin/send-external-card-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          reservationId,
          userEmail,
          userName,
          language,
          variant,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "メール送信に失敗しました");
      }

      // 邮件发送成功
      setEmailSent(true);
    } catch (error) {
      console.error("Error sending email:", error);
      setFormError(
        error instanceof Error
          ? error.message
          : "メール送信中にエラーが発生しました"
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 表单部分 */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
          カード情報入力
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* 客户姓名 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic">
              お名前
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="例：山田 太郎"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          {/* 客户邮箱 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic">
              メールアドレス
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="例：example@email.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 开始日期和时间 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic">
              開始日時
            </label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 结束日期和时间 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic">
              終了日時
            </label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 房间选择 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic">
              部屋選択
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">部屋を選択してください</option>
              {Object.entries(roomOptions).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 错误信息 */}
        {formError && (
          <div className="mt-4 text-red-600 text-sm font-zen-kaku-gothic">
            {formError}
          </div>
        )}

        {/* 提交按钮 */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleGenerateCard}
            disabled={isGenerating}
            className={`px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-zen-kaku-gothic ${
              isGenerating
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-700"
            }`}
          >
            {isGenerating 
              ? "生成中..." 
              : "カードを発行"}
          </button>
        </div>
      </div>

      {/* 生成的卡片信息 */}
      {generatedCard && (
        <div className={`${emailSent ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} p-6 rounded-lg border`}>
          <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
            生成されたカード
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                <span className="font-medium">カード番号:</span>{" "}
                {generatedCard.cardNumber}
              </p>
              <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                <span className="font-medium">お名前:</span>{" "}
                {userName}
              </p>
              <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                <span className="font-medium">メールアドレス:</span>{" "}
                {userEmail}
              </p>
              <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                <span className="font-medium">部屋番号:</span>{" "}
                {generatedCard.physicalRoomId.replace("room_", "")}
              </p>
              <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                <span className="font-medium">有効期間:</span>{" "}
                {new Date(generatedCard.startAt).toLocaleString()} ~{" "}
                {new Date(generatedCard.endAt).toLocaleString()}
              </p>
              <p className="text-sm text-gray-700 mt-3 font-zen-kaku-gothic">
                <span className="font-medium text-base">メール送信状態:</span>{" "}
                {emailSent ? (
                  <span className="text-white bg-green-600 px-2 py-0.5 rounded text-base font-medium">
                    {emailLanguage === "ja"
                      ? "日本語で送信完了"
                      : emailLanguage === "ja_day"
                      ? "日本語（日帰り用）で送信完了"
                      : "英語で送信完了"}
                  </span>
                ) : isSendingEmail ? (
                  <span className="text-white bg-blue-600 px-2 py-0.5 rounded text-base font-medium">送信中...</span>
                ) : (
                  <span className="text-white bg-yellow-600 px-2 py-0.5 rounded text-base font-medium">未送信</span>
                )}
              </p>
            </div>

            <div className="flex flex-col items-center">
              {generatedCard.barcode && (
                <div>
                  {generatedCard.barcode.startsWith("data:image") ? (
                    <Image
                      src={generatedCard.barcode}
                      alt="Barcode"
                      width={400}
                      height={120}
                      className="mx-auto max-w-full h-auto"
                    />
                  ) : (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: generatedCard.barcode,
                      }}
                      className="mx-auto overflow-auto"
                      style={{ maxWidth: "100%" }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* メール送信ボタン */}
          {!emailSent && (
            <div className="mt-6 border-t pt-4">
              <p className="text-sm text-gray-700 mb-3 font-zen-kaku-gothic font-medium">
                お客様へメールを送信:
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <button
                  onClick={() =>
                    sendCardEmail(generatedCard.reservationId, "ja")
                  }
                  disabled={isSendingEmail}
                  className={`px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-zen-kaku-gothic ${
                    isSendingEmail
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-blue-700"
                  }`}
                >
                  {isSendingEmail && emailLanguage === "ja"
                    ? "送信中..."
                    : "日本語で送信"}
                </button>
                <button
                  onClick={() =>
                    sendCardEmail(generatedCard.reservationId, "en")
                  }
                  disabled={isSendingEmail}
                  className={`px-6 py-2 bg-green-600 text-white rounded-md text-sm font-zen-kaku-gothic ${
                    isSendingEmail
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-green-700"
                  }`}
                >
                  {isSendingEmail && emailLanguage === "en"
                    ? "Sending..."
                    : "Send in English"}
                </button>
                <button
                  onClick={() =>
                    sendCardEmail(
                      generatedCard.reservationId,
                      "ja",
                      "daytrip"
                    )
                  }
                  disabled={isSendingEmail}
                  className={`px-6 py-2 bg-gray-400 text-white rounded-md text-sm font-zen-kaku-gothic ${
                    isSendingEmail
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-gray-500"
                  }`}
                >
                  {isSendingEmail && emailLanguage === "ja_day"
                    ? "送信中..."
                    : "日本語で送信（日帰り用）"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 font-zen-kaku-gothic">
              {emailSent 
                ? "カードが正常に発行され、お客様にメールが送信されました。"
                : "カードが正常に発行されました。メール送信ボタンから言語を選択してお客様に送信してください。"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 
