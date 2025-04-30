"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface RoomCard {
  barcode: string;
  physicalRoomId: string;
  startAt: any;
  endAt: any;
  cardNumber: string;
}

interface Reservation {
  userFullName?: string;
  userName?: string;
  userEmail?: string;
}

// 主要内容组件
function ExternalCardViewContent() {
  const searchParams = useSearchParams();
  const reservationId = searchParams.get("reservationId");
  const cardId = searchParams.get("cardId");
  const secureToken = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<RoomCard | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [expired, setExpired] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);

  // 检查卡片有效性
  const checkCardValidity = useCallback((cardData: RoomCard | null) => {
    if (!cardData || !cardData.endAt) return false;

    let endTime;
    if (cardData.endAt && typeof cardData.endAt === "object") {
      // 处理Firestore时间戳格式
      if (cardData.endAt._seconds || cardData.endAt.seconds) {
        const seconds = cardData.endAt._seconds || cardData.endAt.seconds;
        endTime = new Date(seconds * 1000);
      } else if (
        cardData.endAt.toDate &&
        typeof cardData.endAt.toDate === "function"
      ) {
        // 处理Firestore的Timestamp对象
        endTime = cardData.endAt.toDate();
      } else {
        // 如果是普通对象但不是时间戳格式
        endTime = new Date(); // 默认值防止出错
      }
    } else {
      // 尝试作为日期字符串处理
      endTime = new Date(cardData.endAt);
    }

    const now = new Date();

    // 检查日期是否有效
    if (isNaN(endTime.getTime())) {
      console.error("无效的结束日期");
      setExpired(true);
      setCountdown(0);
      return false;
    }

    const isExpired = now > endTime;
    setExpired(isExpired);

    if (!isExpired) {
      const remainingMs = endTime.getTime() - now.getTime();
      const remainingHours = Math.max(
        0,
        Math.floor(remainingMs / (1000 * 60 * 60))
      );
      setCountdown(remainingHours);
    } else {
      setCountdown(0);
    }

    return !isExpired;
  }, []);

  // 获取数据
  useEffect(() => {
    async function fetchData() {
      if (!reservationId || !cardId) {
        setError("必要なパラメータが不足しています");
        setLoading(false);
        return;
      }

      try {
        // 使用专门的外部预约API
        const apiUrl = `/api/external-card-access?reservationId=${reservationId}&cardId=${cardId}${
          secureToken ? `&token=${secureToken}` : ""
        }`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!response.ok) {
          console.error("API response not OK:", data.error);
          setError(data.error || "データの取得中にエラーが発生しました");
          setLoading(false);
          return;
        }

        // 处理API返回的错误信息
        if (data.error) {
          console.error("Error in API response:", data.error);
          setError(data.error);
        }

        // 设置卡片和预约数据
        if (data.card) {
          const cardData = data.card as RoomCard;
          setCard(cardData);
          checkCardValidity(cardData);
        } else {
          console.error("No card data in response");
          setError("カード情報が見つかりません");
        }

        if (data.reservation) {
          setReservation(data.reservation as Reservation);
        } else {
          console.warn("No reservation data in response");
        }

        setLoading(false);
      } catch (err) {
        console.error("データ取得エラー:", err);
        setError("カード情報の取得中にエラーが発生しました");
        setLoading(false);
      }
    }

    fetchData();
  }, [reservationId, cardId, secureToken, checkCardValidity]);

  // 时间格式化
  const formatDate = (timestamp: any): string => {
    try {
      if (!timestamp) return "日付不明";

      let date;
      if (typeof timestamp === "object") {
        // 处理Firestore时间戳格式
        if (timestamp._seconds || timestamp.seconds) {
          const seconds = timestamp._seconds || timestamp.seconds;
          date = new Date(seconds * 1000);
        } else if (timestamp.toDate && typeof timestamp.toDate === "function") {
          // 处理Firestore的Timestamp对象
          date = timestamp.toDate();
        } else {
          // 如果是普通对象但不是时间戳格式
          console.error("不支持的日期对象格式:", timestamp);
          return "日付不明";
        }
      } else {
        // 尝试作为日期字符串处理
        date = new Date(timestamp);
      }

      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        console.error("无效的日期格式:", timestamp);
        return "日付不明";
      }

      // 格式化为日本本地时间
      return date.toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("日付フォーマットエラー:", error);
      return "日付不明";
    }
  };

  // 房间号格式化
  const formatRoomNumber = (physicalRoomId: string) => {
    if (!physicalRoomId) return "---";
    return physicalRoomId.replace("room_", "");
  };

  // 获取房间类型名称
  const getRoomTypeName = (physicalRoomId: string | null): string => {
    if (!physicalRoomId) return "部屋タイプ不明";

    const roomId = physicalRoomId;
    // 特定房间的精确匹配
    if (roomId === "room_101") return "プライベートサウナ tototo";
    if (roomId === "room_102") return "プライベートサウナ fuuu";
    if (roomId === "room_103") return "プライベートサウナ zabuun";
    if (roomId === "room_104") return "プライベートサウナ toron";
    if (roomId === "room_201") return "サウナスイート";

    // 所有慢房间的匹配
    if (
      roomId === "room_202" ||
      roomId === "room_203" ||
      roomId === "room_204" ||
      roomId === "room_205" ||
      roomId === "room_206" ||
      roomId.startsWith("room_3")
    ) {
      return "スロールーム";
    }

    // 通用匹配
    if (roomId.startsWith("room_1")) return "サウナルーム";
    if (roomId.startsWith("room_2")) return "サウナルーム";

    // 默认返回
    return "部屋タイプ不明";
  };

  // 加载中状态
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 md:p-8">
          <div className="flex justify-center mb-6">
            <div className="w-32 mx-auto relative mb-6">
                <Image
                src="/images/logo.svg"
                alt="etoe logo"
                width={128}
                height={70}
                className="w-full h-auto"
                />
            </div>
          </div>
          <p className="text-center text-gray-700 font-zen-kaku-gothic">
            読み込み中...
          </p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 md:p-8">
          <div className="flex justify-center mb-6">
            <div className="w-32 mx-auto relative mb-6">
                <Image
                src="/images/logo.svg"
                alt="etoe logo"
                width={128}
                height={70}
                className="w-full h-auto"
                />
            </div>
          </div>
          <div className="text-center mb-6">
            <h2 className="text-red-600 font-medium mb-2 font-zen-kaku-gothic">
              エラーが発生しました
            </h2>
            <p className="text-gray-700 font-zen-kaku-gothic">{error}</p>
          </div>
          <div className="flex justify-center">
            <Link
              href="/"
              className="px-6 py-2 bg-gray-800 text-white rounded-full text-sm"
            >
              トップページに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 没有卡片信息
  if (!card) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 md:p-8">
          <div className="flex justify-center mb-6">
            <div className="w-32 mx-auto relative mb-6">
                <Image
                src="/images/logo.svg"
                alt="etoe logo"
                width={128}
                height={70}
                className="w-full h-auto"
                />
            </div>
          </div>
          <div className="text-center mb-6">
            <h2 className="text-red-600 font-medium mb-2 font-zen-kaku-gothic">
              カード情報が見つかりません
            </h2>
            <p className="text-gray-700 font-zen-kaku-gothic">
              カード情報が見つからないか、アクセスできません。
            </p>
          </div>
          <div className="flex justify-center">
            <Link
              href="/"
              className="px-6 py-2 bg-gray-800 text-white rounded-full text-sm"
            >
              トップページに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 主要内容展示
  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="bg-[#F0EAE4] p-6 text-center">
          <div className="w-32 mx-auto relative mb-6">
            <Image
              src="/images/logo.svg"
              alt="etoe logo"
              width={128}
              height={70}
              className="w-full h-auto"
            />
          </div>
          <h1 className="text-gray-800 text-xl font-medium font-zen-kaku-gothic mb-1">
            お部屋カード
          </h1>
        </div>

        <div className="p-6">
          {expired && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100">
                <h3 className="text-center font-medium mb-2 font-zen-kaku-gothic text-red-800">有効期限切れ</h3>
                <p className="text-center text-sm font-zen-kaku-gothic text-red-600">このカードは有効期限が切れています</p>
            </div>
          )}
    
          {reservation && reservation.userName && (
            <div className="mb-6">
              <div className="border-b border-gray-200 pb-2 mb-2">
                <h3 className="text-sm text-gray-500 font-zen-kaku-gothic">
                  お名前
                </h3>
                <p className="text-gray-800 font-medium font-zen-kaku-gothic">
                  {reservation.userName}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap -mx-2 mb-6">
            <div className="w-1/2 px-2">
              <div className="mb-4">
                <h3 className="text-sm text-gray-500 font-zen-kaku-gothic">
                  部屋番号
                </h3>
                <p className="text-gray-800 font-medium font-zen-kaku-gothic">
                  {formatRoomNumber(card.physicalRoomId)}
                </p>
              </div>
            </div>
            <div className="w-1/2 px-2">
              <div className="mb-4">
                <h3 className="text-sm text-gray-500 font-zen-kaku-gothic">
                  部屋タイプ
                </h3>
                <p className="text-gray-800 font-medium font-zen-kaku-gothic">
                  {getRoomTypeName(card.physicalRoomId)}
                </p>
              </div>
            </div>
            <div className="w-1/2 px-2">
              <div className="mb-4">
                <h3 className="text-sm text-gray-500 font-zen-kaku-gothic">
                  利用開始
                </h3>
                <p className="text-gray-800 text-sm font-zen-kaku-gothic">
                  {formatDate(card.startAt)}
                </p>
              </div>
            </div>
            <div className="w-1/2 px-2">
              <div className="mb-4">
                <h3 className="text-sm text-gray-500 font-zen-kaku-gothic">
                  利用終了
                </h3>
                <p className="text-gray-800 text-sm font-zen-kaku-gothic">
                  {formatDate(card.endAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mb-6 relative">
            <h3 className="font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
              入室用バーコード
            </h3>
            {card.barcode ? (
              <div
                className={`inline-block mx-auto ${
                  expired ? "opacity-50" : ""
                }`}
              >
                <Image
                  src={card.barcode}
                  alt="入室バーコード"
                  width={320}
                  height={250}
                  className="w-[290px] md:w-[320px] h-auto rounded"
                  unoptimized={true}
                />
                {expired && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm transform rotate-12">
                      有効期限切れ
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-red-500 font-zen-kaku-gothic">
                バーコードが見つかりません
              </p>
            )}
            <p className="text-sm text-gray-600 mt-4 font-zen-kaku-gothic">
              上記バーコードを部屋前のスキャナーにかざすか、
              <br />
              スマホをリーダーにタッチして入室してください
            </p>
          </div>

          <div className="mt-4 md:mt-6 flex justify-center">
            <button
              onClick={() => (window.location.href = "/")}
              className="px-6 md:px-8 py-2 md:py-3 text-[13px] md:text-sm font-medium text-white bg-gray-700 rounded-full hover:bg-gray-800"
            >
              トップページに戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 包装Suspense组件
export default function ExternalCardViewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 md:p-8">
            <div className="flex justify-center mb-6">
                <div className="w-32 mx-auto relative mb-6">
                    <Image
                    src="/images/logo.svg"
                    alt="etoe logo"
                    width={128}
                    height={70}
                    className="w-full h-auto"
                    />
                </div>
            </div>
            <p className="text-center text-gray-700 font-zen-kaku-gothic">
              読み込み中...
            </p>
          </div>
        </div>
      }
    >
      <ExternalCardViewContent />
    </Suspense>
  );
} 