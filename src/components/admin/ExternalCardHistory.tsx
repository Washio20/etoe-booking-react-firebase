"use client";

import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Image from "next/image";
import { formatTimestamp } from "@/utils/date";

// 外部预约记录接口
interface ExternalReservation {
  id: string;
  userName: string;
  userEmail: string;
  physicalRoomId: string;
  startAt: any; // Firestore Timestamp
  endAt: any; // Firestore Timestamp
  cardNumber: string;
  cardEmailSent?: boolean;
  cardEmailSentAt?: any; // Firestore Timestamp
  createdAt: any; // Firestore Timestamp
  createdBy: string;
  barcode?: string;
  status: string;
}

export default function ExternalCardHistory() {
  const [user] = useAuthState(auth);
  const [reservations, setReservations] = useState<ExternalReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isResending, setIsResending] = useState<string | null>(null);

  // 获取外部预约历史
  const fetchExternalReservations = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/external-reservations", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "データの取得に失敗しました");
      }

      const data = await response.json();
      setReservations(data.reservations || []);
    } catch (error) {
      console.error("Error fetching external reservations:", error);
      setError(
        error instanceof Error
          ? error.message
          : "データの取得中にエラーが発生しました"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 重新发送邮件
  const resendEmail = async (
    reservationId: string,
    userEmail: string,
    userName: string
  ) => {
    if (!user || isResending) return;

    try {
      setIsResending(reservationId);

      const idToken = await user.getIdToken();
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "メール送信に失敗しました");
      }

      // 重新获取数据
      await fetchExternalReservations();
      alert("メールを再送信しました");
    } catch (error) {
      console.error("Error resending email:", error);
      alert(
        error instanceof Error
          ? error.message
          : "メール送信中にエラーが発生しました"
      );
    } finally {
      setIsResending(null);
    }
  };

  // 格式化日期时间 - 使用统一的日期工具函数
  const formatDateTime = (timestamp: any) => {
    return formatTimestamp(timestamp, "yyyy/MM/dd HH:mm", "未設定");
  };

  // 获取房间类型显示
  const getRoomTypeDisplay = (physicalRoomId: string) => {
    const roomNumber = physicalRoomId.replace("room_", "");
    const firstDigit = roomNumber.charAt(0);

    if (firstDigit === "1") {
      if (roomNumber === "101") return "TOTOTO";
      if (roomNumber === "102") return "FUUU";
      if (roomNumber === "103") return "ZABUUN";
      if (roomNumber === "104") return "TORON";
    } else if (firstDigit === "2") {
      if (roomNumber === "201") return "サウナスイート";
      return "スロールーム";
    } else if (firstDigit === "3") {
      return "スロールーム";
    }

    return "未知";
  };

  useEffect(() => {
    fetchExternalReservations();
  }, [user]);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
          外部予約カード発送履歴
        </h2>
        <div className="flex justify-center py-8">
          <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
          外部予約カード発送履歴
        </h2>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-600 font-zen-kaku-gothic">{error}</p>
          <button
            onClick={fetchExternalReservations}
            className="mt-2 text-blue-600 underline text-sm font-zen-kaku-gothic"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {reservations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 font-zen-kaku-gothic">
            外部予約の履歴がありません
          </p>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto">
          {reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <h3 className="font-medium text-gray-800 font-zen-kaku-gothic">
                      {reservation.userName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-gray-500 font-zen-kaku-gothic">
                        部屋: {reservation.physicalRoomId.replace("room_", "")}{" "}
                        ({getRoomTypeDisplay(reservation.physicalRoomId)})
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium font-zen-kaku-gothic ${
                          reservation.cardEmailSent
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {reservation.cardEmailSent ? "送信済み" : "未送信"}
                      </span>
                    </div>
                  </div>

                  {/* 详细信息 */}
                  <div className="space-y-2 text-sm text-gray-600 font-zen-kaku-gothic">
                    <p className="break-words">
                      <span className="font-medium">メール:</span>{" "}
                      {reservation.userEmail}
                    </p>
                    <p className="break-all">
                      <span className="font-medium">カード番号:</span>{" "}
                      {reservation.cardNumber}
                    </p>
                    <p className="break-words">
                      <span className="font-medium">利用期間:</span>{" "}
                      {formatDateTime(reservation.startAt)} ～{" "}
                      {formatDateTime(reservation.endAt)}
                    </p>
                    {reservation.cardEmailSent &&
                      reservation.cardEmailSentAt && (
                        <p className="break-words">
                          <span className="font-medium">送信日時:</span>{" "}
                          {formatDateTime(reservation.cardEmailSentAt)}
                        </p>
                      )}
                  </div>
                </div>

                {/* 操作按钮区域 */}
                <div className="flex flex-row lg:flex-col gap-2 lg:shrink-0">
                  {/* 查看条形码按钮 */}
                  <button
                    onClick={() =>
                      setExpandedCard(
                        expandedCard === reservation.id ? null : reservation.id
                      )
                    }
                    className="flex-1 lg:flex-none px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-zen-kaku-gothic hover:bg-blue-200 transition-colors whitespace-nowrap"
                  >
                    {expandedCard === reservation.id
                      ? "非表示"
                      : "バーコード表示"}
                  </button>

                  {/* 重新发送邮件按钮 */}
                  <button
                    onClick={() =>
                      resendEmail(
                        reservation.id,
                        reservation.userEmail,
                        reservation.userName
                      )
                    }
                    disabled={isResending === reservation.id}
                    className={`flex-1 lg:flex-none px-3 py-1 rounded text-sm font-zen-kaku-gothic transition-colors whitespace-nowrap ${
                      isResending === reservation.id
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {isResending === reservation.id ? "送信中..." : "再送信"}
                  </button>
                </div>
              </div>

              {/* 展开的条形码显示 */}
              {expandedCard === reservation.id && reservation.barcode && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-center bg-white p-4 rounded border">
                    {reservation.barcode.startsWith("data:image") ? (
                      <Image
                        src={reservation.barcode}
                        alt="Barcode"
                        width={400}
                        height={120}
                        className="max-w-full h-auto"
                        unoptimized={true}
                      />
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: reservation.barcode,
                        }}
                        className="max-w-full overflow-auto"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2 font-zen-kaku-gothic">
                    カード番号: {reservation.cardNumber}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
