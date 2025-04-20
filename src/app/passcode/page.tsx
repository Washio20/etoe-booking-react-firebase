"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Image from "next/image";
import Layout from "@/components/Layout";

interface RoomCard {
  id: string;
  barcode: string | null;
  qrcode: string | null;
  physicalRoomId: string | null;
  cardNumber: string | null;
  startAt: any;
  endAt: any;
}

interface ReservationData {
  startDateTime: any;
  endDateTime: any;
  roomType: string | null;
  userFullName: string | null;
  userName: string | null;
  slowRoomAsSetPlan: boolean;
  slowRoomStartDateTime: any;
  slowRoomEndDateTime: any;
}

export default function PasscodePage() {
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  const [roomNumber, setRoomNumber] = useState("---");
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [roomCards, setRoomCards] = useState<RoomCard[]>([]);
  const [cardLoading, setCardLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [userName, setUserName] = useState<string | null>(null);
  const [reservationData, setReservationData] =
    useState<ReservationData | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  // 处理Firebase Timestamp对象
  const parseTimestamp = (timestamp: any): Date | null => {
    if (!timestamp) return null;

    try {
      // Firebase Admin SDK (后端) 返回的Timestamp格式
      if (timestamp && typeof timestamp === "object") {
        // 处理后端返回的包含seconds和nanoseconds的格式
        if (
          timestamp._seconds !== undefined ||
          timestamp.seconds !== undefined
        ) {
          const seconds =
            timestamp._seconds !== undefined
              ? timestamp._seconds
              : timestamp.seconds;
          return new Date(seconds * 1000);
        }
        // 处理可能的Date对象
        if (timestamp instanceof Date) {
          return timestamp;
        }
        // 处理可能包含toDate方法的对象
        if (timestamp.toDate && typeof timestamp.toDate === "function") {
          return timestamp.toDate();
        }
      }
      // 处理ISO日期字符串
      if (typeof timestamp === "string") {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      // 处理数字时间戳(毫秒)
      if (typeof timestamp === "number") {
        return new Date(timestamp);
      }
    } catch (error) {
      console.error("时间戳解析错误:", error, timestamp);
    }

    return null;
  };

  // 格式化日期
  const formatDate = (date: Date | null): string => {
    if (!date || isNaN(date.getTime())) {
      return "--/--/-- --:--";
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  // 在组件挂载时获取预约信息
  useEffect(() => {
    if (!user) return;

    // 从API获取用户的预约信息和卡信息
    async function fetchReservationAndCards() {
      if (!user) return;

      try {
        setCardLoading(true);
        console.log("Fetching reservation and card data...");

        // 获取用户认证令牌
        const idToken = await user.getIdToken();

        // 使用API获取用户的预订和卡片信息（使用认证令牌）
        const response = await fetch(`/api/user-cards`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        const data = await response.json();
        console.log("API response:", data);
        setDebugInfo(JSON.stringify(data, null, 2));

        if (response.ok && data.success) {
          if (data.reservationId) {
            setReservationId(data.reservationId);

            // 使用API返回的预约数据
            if (data.reservationData) {
              const reservationData = data.reservationData as ReservationData;
              setReservationData(reservationData);

              // 设置用户名称
              if (reservationData.userFullName) {
                setUserName(reservationData.userFullName);
              } else if (reservationData.userName) {
                setUserName(reservationData.userName);
              }

              // 设置房间号码（根据房间类型）
              if (reservationData.roomType) {
                switch (reservationData.roomType) {
                  case "tototo":
                    setRoomNumber("101");
                    break;
                  case "fuuu":
                    setRoomNumber("201");
                    break;
                  case "zabuun":
                    setRoomNumber("301");
                    break;
                  case "toron":
                    setRoomNumber("401");
                    break;
                  case "sauna_suite":
                    setRoomNumber("501");
                    break;
                  case "slow_room":
                    setRoomNumber("601");
                    break;
                  default:
                    setRoomNumber("---");
                }
              }
            }

            // 设置房卡信息
            if (data.cards && data.cards.length > 0) {
              // 对card排序：1. 按入住时间排序（较早的先显示）2. 如果是套餐预约，主房间优先
              const sortedCards = [...data.cards].sort((a, b) => {
                // 获取卡片的入住时间
                const getStartTime = (card: any, resData: any) => {
                  if (
                    card.physicalRoomId?.includes("601") &&
                    resData?.slowRoomAsSetPlan
                  ) {
                    return resData.slowRoomStartDateTime?.seconds || 0;
                  }
                  return (
                    card.startAt?.seconds ||
                    resData?.startDateTime?.seconds ||
                    0
                  );
                };

                const aStartTime = getStartTime(a, data.reservationData);
                const bStartTime = getStartTime(b, data.reservationData);

                // 首先按入住时间排序
                if (aStartTime !== bStartTime) {
                  return aStartTime - bStartTime; // 升序，较早的时间排在前面
                }

                // 如果入住时间相同且是慢房间预订，主房间卡片排在前面
                if (data.reservationData?.slowRoomAsSetPlan) {
                  const aIsSlowRoom =
                    a.physicalRoomId?.includes("601") || false;
                  const bIsSlowRoom =
                    b.physicalRoomId?.includes("601") || false;
                  if (aIsSlowRoom && !bIsSlowRoom) return 1;
                  if (!aIsSlowRoom && bIsSlowRoom) return -1;
                }

                return 0;
              });

              setRoomCards(sortedCards);
            }
          }
        } else {
          console.error("获取预订信息失败:", data.error);
        }
      } catch (error) {
        console.error("获取预约信息错误", error);
      } finally {
        setCardLoading(false);
      }
    }

    fetchReservationAndCards();
  }, [user]);

  // 使用单一状态管理用户显示名称，避免闪烁
  useEffect(() => {
    if (reservationData?.userFullName) {
      setUserName(reservationData.userFullName);
    }
  }, [reservationData]);

  // 获取房间类型名称
  const getRoomTypeName = (
    card: RoomCard | null,
    reservationData: ReservationData | null
  ): string => {
    // 先根据物理房间ID判断
    if (card && card.physicalRoomId) {
      const roomId = card.physicalRoomId;
      // 特定房间的精确匹配
      if (roomId === "room_101") return "プライベートサウナ: tototo";
      if (roomId === "room_102") return "プライベートサウナ: fuuu";
      if (roomId === "room_103") return "プライベートサウナ: zabuun";
      if (roomId === "room_104") return "プライベートサウナ: toron";
      if (roomId === "room_201") return "サウナスイート";

      // 所有慢房间的匹配 - 包括room_202到room_206和room_301到room_305
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
    if (reservationData && reservationData.roomType) {
      switch (reservationData.roomType) {
        case "tototo":
          return "プライベートサウナ: tototo";
        case "fuuu":
          return "プライベートサウナ: fuuu";
        case "zabuun":
          return "プライベートサウナ: zabuun";
        case "toron":
          return "プライベートサウナ: toron";
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

  // 获取房卡的入住和退房时间
  const getCardTimes = (
    card: RoomCard,
    reservationData: ReservationData | null
  ) => {
    // 如果是慢房间
    if (
      card.physicalRoomId?.includes("601") &&
      reservationData?.slowRoomAsSetPlan
    ) {
      return {
        checkIn: formatDate(
          parseTimestamp(reservationData.slowRoomStartDateTime)
        ),
        checkOut: formatDate(
          parseTimestamp(reservationData.slowRoomEndDateTime)
        ),
      };
    }

    // 普通房间或者没有特殊处理的情况
    return {
      checkIn: formatDate(
        parseTimestamp(card.startAt || reservationData?.startDateTime)
      ),
      checkOut: formatDate(
        parseTimestamp(card.endAt || reservationData?.endDateTime)
      ),
    };
  };

  // 切换到下一张卡片
  const handleNextCard = () => {
    if (roomCards.length > 1) {
      setActiveCardIndex((prevIndex) => (prevIndex + 1) % roomCards.length);
    }
  };

  // 切换到上一张卡片
  const handlePrevCard = () => {
    if (roomCards.length > 1) {
      setActiveCardIndex(
        (prevIndex) => (prevIndex - 1 + roomCards.length) % roomCards.length
      );
    }
  };

  // 当前显示的卡片
  const activeCard = roomCards.length > 0 ? roomCards[activeCardIndex] : null;

  // 获取房卡的简短房间名称显示
  const getShortRoomName = (card: RoomCard): string => {
    if (card.physicalRoomId) {
      return card.physicalRoomId.replace("room_", "");
    }
    return roomNumber;
  };

  // 处理加载状态
  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[400px]">
          <p className="text-[#444444] font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </Layout>
    );
  }

  // 处理未登录状态
  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <p className="text-[#444444] font-zen-kaku-gothic">
            入室パスコードを表示するには、ログインしてください。
          </p>
          <button
            onClick={() => router.push("/login?returnTo=/passcode")}
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
          >
            ログイン
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-[#FAF9F7] pt-2 md:pt-4 pb-4 md:pb-6">
        <div className="max-w-md mx-auto py-2 md:py-4 px-4 md:px-0">
          <div className="border-b border-[rgba(68,68,68,0.2)] pb-2 md:pb-4 mb-4 md:mb-6">
            <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              入室用パスコード
            </h1>
          </div>

          {/* 用户信息 */}
          {!cardLoading && (
            <div className="mb-6 text-center">
              <h2 className="text-lg md:text-xl font-bold text-[#8A7A6A]">
                {userName || user.displayName || user.email} 様
              </h2>
            </div>
          )}

          {/* 卡片切换指示器 - 当有多个卡片时显示 */}
          {roomCards.length > 1 && activeCard && (
            <div className="mb-4 flex justify-center items-center">
              <div className="flex items-center bg-gray-100 rounded-full px-5 py-2">
                <span className="text-sm md:text-base font-medium text-gray-700">
                  {getRoomTypeName(activeCard, reservationData)}
                </span>
              </div>
            </div>
          )}

          {/* 显示当前激活的卡片 */}
          {cardLoading ? (
            <div className="flex justify-center items-center h-[200px]">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-700"></div>
            </div>
          ) : roomCards.length === 0 ? (
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-gray-500">有効なカードがありません</p>
            </div>
          ) : activeCard ? (
            <div>
              {/* カード本体 */}
              <div className="bg-[#CCBBAC] rounded-lg overflow-hidden relative">
                {/* ロゴエリア */}
                <div className="p-3 md:p-4 flex justify-between items-center bg-[#CCBBAC]">
                  <Image
                    src="/images/logo.svg"
                    alt="naNA SAUNA AND HOTEL"
                    width={100}
                    height={30}
                    className="h-7 md:h-9 w-auto brightness-0 invert"
                  />
                  <div className="flex flex-col items-end">
                    <div className="text-white text-[9px] md:text-[10px] font-medium tracking-wider">
                      部屋番号
                    </div>
                    <div className="text-white text-[18px] md:text-[21px] font-bold">
                      {getShortRoomName(activeCard)}
                    </div>
                  </div>
                </div>

                {/* 区切り線 */}
                <div className="relative">
                  <div className="border-t border-dashed border-[#E5DBD3]"></div>
                  {/* 左端の半円 */}
                  <div className="absolute w-2 h-2 md:w-3 md:h-3 bg-white rounded-full left-[-4px] md:left-[-6px] top-[-4px] md:top-[-6px]"></div>
                  {/* 右端の半円 */}
                  <div className="absolute w-2 h-2 md:w-3 md:h-3 bg-white rounded-full right-[-4px] md:right-[-6px] top-[-4px] md:top-[-6px]"></div>
                </div>

                {/* ユーザー情報 */}
                <div className="p-4 md:p-8 flex flex-col items-center">
                  <div className="mb-4 md:mb-6">
                    {activeCard.barcode ? (
                      <div className="flex justify-center">
                        <Image
                          src={activeCard.barcode}
                          alt="入室用バーコード"
                          width={320}
                          height={250}
                          className="w-[290px] md:w-[320px] h-auto rounded"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex justify-center items-center h-[250px] md:h-[280px]">
                        <div className="text-white text-xs text-center">
                          バーコードなし
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 案内文 */}
                  <p className="text-white text-[10px] md:text-xs leading-relaxed tracking-wider text-center mb-6 md:mb-8">
                    バーコードをリーダーにかざすか、
                    <br />
                    スマホをリーダーにタッチして入室ください。
                  </p>

                  {/* 予約情報 */}
                  <div className="w-full relative">
                    <div className="relative">
                      <div className="border-t border-dashed border-[#E5DBD3]"></div>
                    </div>

                    {/* 中央の縦線 - 上部虚線からスタート */}
                    <div className="absolute left-1/2 top-0 bottom-0 transform -translate-x-1/2">
                      <div className="h-full border-l border-dashed border-[#E5DBD3]"></div>
                    </div>

                    {/* チェックイン・チェックアウト情報を横に並べる */}
                    <div className="flex justify-between mt-4">
                      {/* チェックイン */}
                      <div className="flex flex-col">
                        <span className="text-white text-[10px] md:text-xs font-medium tracking-wide">
                          チェックイン日時
                        </span>
                        <span className="text-white text-[14px] md:text-lg font-bold">
                          {getCardTimes(activeCard, reservationData).checkIn}
                        </span>
                      </div>

                      {/* チェックアウト */}
                      <div className="flex flex-col">
                        <span className="text-white text-[10px] md:text-xs font-medium tracking-wide">
                          チェックアウト日時
                        </span>
                        <span className="text-white text-[14px] md:text-lg font-bold">
                          {getCardTimes(activeCard, reservationData).checkOut}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 卡片切换按钮 - 当有多个卡片时显示 */}
              {roomCards.length > 1 && (
                <div className="mt-6 flex justify-center space-x-4">
                  <button
                    onClick={handlePrevCard}
                    disabled={activeCardIndex === 0}
                    className={`px-4 py-2 rounded-full flex items-center ${
                      activeCardIndex === 0
                        ? "bg-[#C9BBAD] text-[#E5DDD5] cursor-not-allowed"
                        : "bg-[#8A7A6A] text-white hover:bg-[#786A5C] transition-colors"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    前のカード
                  </button>
                  <button
                    onClick={handleNextCard}
                    disabled={activeCardIndex === roomCards.length - 1}
                    className={`px-4 py-2 rounded-full flex items-center ${
                      activeCardIndex === roomCards.length - 1
                        ? "bg-[#C9BBAD] text-[#E5DDD5] cursor-not-allowed"
                        : "bg-[#8A7A6A] text-white hover:bg-[#786A5C] transition-colors"
                    }`}
                  >
                    次のカード
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {/* ボタン */}
          <div className="mt-4 md:mt-6 flex justify-center">
            <button
              onClick={() => router.push("/")}
              className="px-6 md:px-8 py-2 md:py-3 text-[13px] md:text-sm font-medium text-white bg-gray-700 rounded-full hover:bg-gray-800"
            >
              トップページに戻る
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
