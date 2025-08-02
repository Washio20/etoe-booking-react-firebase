"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import FacilityGuideDialog from "@/components/FacilityGuideDialog";

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
  status?: string;
  roomType?: string;
}

// 创建一个CardViewContent组件，包含主要逻辑
function CardViewContent() {
  const searchParams = useSearchParams();
  const reservationId = searchParams.get("reservationId");
  const cardId = searchParams.get("cardId");
  const secureToken = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [card, setCard] = useState<RoomCard | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [expired, setExpired] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [showGuideDialog, setShowGuideDialog] = useState<boolean>(false);

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

  useEffect(() => {
    async function fetchData() {
      if (!reservationId || !cardId) {
        setError("必要なパラメータが不足しています");
        setLoading(false);
        return;
      }

      try {
        setDebugInfo(
          `Params: reservationId=${reservationId}, cardId=${cardId}, token=${secureToken}`
        );

        // 使用API端点获取数据而不是直接访问Firestore
        try {
          const apiUrl = `/api/card-access?reservationId=${reservationId}&cardId=${cardId}${
            secureToken ? `&token=${secureToken}` : ""
          }`;

          const response = await fetch(apiUrl);

          const data = await response.json();

          setDebugInfo(
            (prev) => `${prev}\nAPI Response: ${JSON.stringify(data)}`
          );

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
          
          // 成功获取数据后，检查是否需要显示指南对话框
          if (data.card && !data.error) {
            const hasShownGuide = sessionStorage.getItem('facilityGuideShown');
            if (!hasShownGuide) {
              setShowGuideDialog(true);
            }
          }
        } catch (apiError) {
          console.error("Error fetching from API:", apiError);
          setDebugInfo(
            (prev) =>
              `${prev}\nAPI error: ${
                apiError instanceof Error ? apiError.message : String(apiError)
              }`
          );
          setError("データの取得中にエラーが発生しました");
          setLoading(false);
        }
      } catch (err) {
        console.error("データ取得エラー:", err);
        setDebugInfo(
          (prev) =>
            `${prev}\nGeneral error: ${
              err instanceof Error ? err.message : String(err)
            }`
        );
        setError("カード情報の取得中にエラーが発生しました");
        setLoading(false);
      }
    }

    // 仅在组件首次加载或URL参数变化时获取数据
    fetchData();

    // 返回清理函数
    return () => {
      // 没有定时器需要清理
    };
  }, [reservationId, cardId, secureToken, checkCardValidity]);

  const handleCloseGuideDialog = () => {
    setShowGuideDialog(false);
    sessionStorage.setItem('facilityGuideShown', 'true');
  };

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

  const formatRoomNumber = (physicalRoomId: string) => {
    if (!physicalRoomId) return "---";
    return physicalRoomId.replace("room_", "");
  };

  // 获取房间类型名称
  const getRoomTypeName = (
    physicalRoomId: string | null,
    reservation: Reservation | null
  ): string => {
    // 先根据物理房间ID判断
    if (physicalRoomId) {
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
        roomId.startsWith("room_3") ||
        roomId.startsWith("room_6")
      ) {
        return "スロールーム";
      }
    }

    // 如果不是慢房间，根据预约类型判断
    if (reservation && reservation.roomType) {
      switch (reservation.roomType) {
        case "tototo":
          return "プライベートサウナ tototo";
        case "fuuu":
          return "プライベートサウナ fuuu";
        case "zabuun":
          return "プライベートサウナ zabuun";
        case "toron":
          return "プライベートサウナ toron";
        case "sauna_suite":
          return "サウナスイート";
        case "slow_room":
          return "スロールーム";
        default:
          return "プライベートサウナ";
      }
    }

    // 默认返回
    return "通常客室";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-4">
            エラーが発生しました
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4 text-left bg-gray-100 p-4 rounded text-xs overflow-auto max-h-60">
              <pre>{debugInfo}</pre>
            </div>
          )}
          <Link
            href="/"
            className="inline-block bg-gray-700 text-white px-6 py-2 rounded-md hover:bg-gray-800 transition mt-4"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] py-12 px-4 sm:px-6">
      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-[#8A7A6A] text-white px-6 py-4">
          <h1 className="text-xl font-bold font-zen-kaku-gothic">etoe hotel</h1>
          <p className="text-sm opacity-80 font-zen-kaku-gothic">入室カード</p>
        </div>

        <div className="p-6">
          <div className="mb-6 text-center">
            <h2 className="text-lg md:text-xl font-bold text-[#8A7A6A] mb-1 font-zen-kaku-gothic">
              {reservation?.userFullName} 様
            </h2>
            <p className="text-sm text-gray-500 font-zen-kaku-gothic">
              ご予約いただきありがとうございます
            </p>
          </div>

          {expired ? (
            <div className="bg-red-50 p-4 rounded-lg mb-6 border border-red-200">
              <h3 className="font-medium text-red-700 mb-2 font-zen-kaku-gothic">
                有効期限が切れています
              </h3>
              <p className="text-sm text-red-600 font-zen-kaku-gothic">
                このカードの有効期限は切れています。フロントへお問い合わせください。
              </p>
            </div>
          ) : (
            <div className="bg-green-50 p-3 rounded-lg mb-4 border border-green-200">
              <p className="text-sm text-green-700 font-medium font-zen-kaku-gothic">
                このカードは有効です
              </p>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-gray-800 mb-2 font-zen-kaku-gothic">
              カード情報
            </h3>
            <p className="font-zen-kaku-gothic">
              <span className="text-gray-600">部屋番号:</span>{" "}
              <span className="font-zen-kaku-gothic text-[#444444]">
                {card ? formatRoomNumber(card.physicalRoomId) : "---"}
              </span>
            </p>
            <p className="font-zen-kaku-gothic">
              <span className="text-gray-600">部屋タイプ:</span>{" "}
              <span className="font-zen-kaku-gothic text-[#444444]">
                {card
                  ? getRoomTypeName(card.physicalRoomId, reservation)
                  : "---"}
              </span>
            </p>
            <p className="font-zen-kaku-gothic text-[#444444]">
              <span className="text-gray-600">有効期間:</span>{" "}
              {card ? formatDate(card.startAt) : "日付不明"} ~{" "}
              {card ? formatDate(card.endAt) : "日付不明"}
            </p>
            <p className="text-sm text-gray-500 mt-1 font-zen-kaku-gothic">
              ※ 予約時間内のみ有効です
            </p>
          </div>

          <div className="text-center mb-6 relative">
            <h3 className="font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
              入室用バーコード
            </h3>
            {card && card.barcode ? (
              <div
                className={`inline-block mx-auto ${
                  expired ? "opacity-50" : ""
                }`}
              >
                <Image
                  src={card.barcode}
                  alt="入室バーコード"
                  width={400}
                  height={300}
                  className="w-[340px] md:w-[400px] h-auto rounded"
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

          <div className="mt-4 md:mt-6 flex flex-col gap-3">
            <button
              onClick={() => setShowGuideDialog(true)}
              className="px-6 md:px-8 py-2 md:py-3 text-[13px] md:text-sm font-medium text-[#8A7A6A] bg-white border-2 border-[#8A7A6A] rounded-full hover:bg-[#8A7A6A] hover:text-white transition-colors"
            >
              ご利用案内を見る
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="px-6 md:px-8 py-2 md:py-3 text-[13px] md:text-sm font-medium text-white bg-gray-700 rounded-full hover:bg-gray-800 transition-colors"
            >
              トップページに戻る
            </button>
          </div>
        </div>
      </div>
      
      {/* 館内利用方法ダイアログ */}
      <FacilityGuideDialog 
        isOpen={showGuideDialog} 
        onClose={handleCloseGuideDialog}
      />
    </div>
  );
}

// 主组件包装在Suspense中使用CardViewContent
export default function CardViewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">読み込み中...</p>
          </div>
        </div>
      }
    >
      <CardViewContent />
    </Suspense>
  );
}
