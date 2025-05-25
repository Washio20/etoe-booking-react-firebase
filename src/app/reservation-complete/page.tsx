"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Layout from "@/components/Layout";
import { auth } from "@/utils/firebase";
import { onAuthStateChange } from "@/utils/auth";
import { RoomCard, RoomCardStatus } from "@/types/reservation";

// 根据房间号获取房间类型
const getRoomTypeByRoomId = (roomId: string): string => {
  const roomNumber = roomId.replace("room_", "");
  const firstDigit = roomNumber.charAt(0);

  // 根据房间号前缀确定房间类型
  if (firstDigit === "1") {
    // 100系列是纯桑拿房间
    if (roomNumber === "101") return "TOTOTO";
    if (roomNumber === "102") return "FUUU";
    if (roomNumber === "103") return "ZABUUN";
    if (roomNumber === "104") return "TORON";
  } else if (firstDigit === "2") {
    // 200系列
    if (roomNumber === "201") return "サウナスイート";
    return "スロールーム"; // 202-206是慢房间
  } else if (firstDigit === "3") {
    // 300系列全部是慢房间
    return "スロールーム";
  }

  return "未知";
};

// 房间卡展示组件
function RoomCardDisplay({ card }: { card: RoomCard }) {
  const roomType = getRoomTypeByRoomId(card.physicalRoomId);

  return (
    <div className="border rounded-lg p-4 mb-4 bg-white shadow-sm flex flex-col items-center">
      <h3 className="text-lg font-bold mb-2 text-center">ルームカード</h3>
      <div className="space-y-4 w-full flex flex-col items-center">
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-center">
            部屋番号:{" "}
            <span className="font-bold">
              {card.physicalRoomId.replace("room_", "")}
            </span>
          </p>
          <p className="text-sm text-center mt-1">
            部屋タイプ:{" "}
            <span className="font-bold text-gray-700">{roomType}</span>
          </p>
        </div>

        <p className="text-sm text-center w-full">
          有効期間: {new Date(card.startAt).toLocaleString("ja-JP")} ~{" "}
          {new Date(card.endAt).toLocaleString("ja-JP")}
        </p>

        <div className="mt-4 flex flex-col items-center w-full">
          <p className="text-sm font-medium mb-4 text-center">
            入室用バーコード:
          </p>
          {card.barcode && (
            <div className="flex justify-center items-center w-full">
              {card.barcode.startsWith("data:image") ? (
                <Image
                  src={card.barcode}
                  alt="Barcode"
                  width={350}
                  height={120}
                  unoptimized={true}
                  className="object-contain max-w-full"
                />
              ) : (
                <div
                  dangerouslySetInnerHTML={{ __html: card.barcode }}
                  className="max-w-full w-[350px] overflow-auto"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReservationCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(auth.currentUser);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState("");
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [roomCards, setRoomCards] = useState<RoomCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);

  // 监听Firebase认证状态
  useEffect(() => {
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get("session_id");
      if (!sessionId) {
        setError("支払いセッションが見つかりません。");
        setIsVerifying(false);
        return;
      }

      if (!user) {
        setError("認証が必要です。");
        setIsVerifying(false);
        return;
      }

      // 清理过期的验证记录
      cleanupVerifiedPayments();

      // 在本地存储中检查该会话是否已经验证过支付
      const verifiedPayments = JSON.parse(
        localStorage.getItem("verifiedPayments") || "{}"
      );
      if (verifiedPayments[sessionId]) {
        setReservationId(verifiedPayments[sessionId].reservationId);
        setIsVerifying(false);
        return;
      }

      // 获取当前用户的ID令牌
      const idToken = await user.getIdToken();

      const attemptVerification = async (): Promise<boolean> => {
        try {
          const response = await fetch(
            `/api/verify-payment?session_id=${sessionId}`,
            {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            }
          );
          const data = await response.json();

          if (response.ok && data.success) {
            // 支付验证成功，保存预约ID
            localStorage.removeItem("reservationInfo");
            if (data.reservationId) {
              setReservationId(data.reservationId);

              // 将此session_id记录为已验证，避免刷新时重复请求
              verifiedPayments[sessionId] = {
                reservationId: data.reservationId,
                verifiedAt: new Date().toISOString(),
              };

              // 限制存储的支付记录数量
              const maxStoredItems = 20;
              const paymentIds = Object.keys(verifiedPayments);
              if (paymentIds.length > maxStoredItems) {
                // 按时间排序，保留最新的记录
                const sortedIds = paymentIds.sort((a, b) => {
                  const dateA = new Date(
                    verifiedPayments[a].verifiedAt
                  ).getTime();
                  const dateB = new Date(
                    verifiedPayments[b].verifiedAt
                  ).getTime();
                  return dateB - dateA; // 降序，最新的在前
                });

                // 删除旧记录
                const idsToRemove = sortedIds.slice(maxStoredItems);
                idsToRemove.forEach((id) => {
                  delete verifiedPayments[id];
                });
              }

              localStorage.setItem(
                "verifiedPayments",
                JSON.stringify(verifiedPayments)
              );
            }

            console.log("预约找到，处理完成");
            return true;
          }

          // 如果是处理中状态，继续轮询
          if (data.processing) {
            console.log("预约仍在处理中，由webhook负责创建");
            return false;
          }

          // 如果是支付未完成的错误，我们继续重试
          if (data.error === "支払いが完了していません") {
            return false;
          }

          // 其他错误（如认证错误）直接抛出
          throw new Error(data.error || "支払い確認に失敗しました。");
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "支払いが完了していません"
          ) {
            return false;
          }
          throw error;
        }
      };

      const runWithRetry = async () => {
        try {
          // 使用轮询机制，等待webhook完成预约创建
          const maxAttempts = 20; // 最多尝试20次
          const pollInterval = 2000; // 每2秒检查一次（总计40秒）
          let attemptCount = 0;

          console.log("开始轮询检查webhook创建的预约状态...");

          while (attemptCount < maxAttempts) {
            const success = await attemptVerification();
            if (success) {
              console.log(`轮询成功，第${attemptCount + 1}次尝试找到预约`);
              setIsVerifying(false);
              return;
            }

            attemptCount++;
            if (attemptCount < maxAttempts) {
              console.log(
                `第${attemptCount}次检查未找到预约，${
                  pollInterval / 1000
                }秒后重试...`
              );
              await new Promise((resolve) => setTimeout(resolve, pollInterval));
            }
          }

          // 如果所有轮询都失败，可能是webhook处理失败
          setError(
            "予約処理に時間がかかっています。支払いは正常に完了していますので、予約一覧で状態をご確認ください。"
          );
        } catch (error) {
          console.error("Error verifying payment:", error);
          setError(
            error instanceof Error
              ? error.message
              : "支払い確認中にエラーが発生しました。"
          );
        } finally {
          setIsVerifying(false);
        }
      };

      runWithRetry();
    };

    if (!isLoading && user) {
      verifyPayment();
    }
  }, [isLoading, user, searchParams]);

  // 清理过期的验证记录
  const cleanupVerifiedPayments = () => {
    try {
      const verifiedPayments = JSON.parse(
        localStorage.getItem("verifiedPayments") || "{}"
      );
      const now = new Date().getTime();
      let hasChanges = false;

      // 保留30天内的记录
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天，毫秒

      Object.keys(verifiedPayments).forEach((sessionId) => {
        const verifiedAt = new Date(
          verifiedPayments[sessionId].verifiedAt
        ).getTime();
        if (now - verifiedAt > maxAge) {
          delete verifiedPayments[sessionId];
          hasChanges = true;
        }
      });

      if (hasChanges) {
        localStorage.setItem(
          "verifiedPayments",
          JSON.stringify(verifiedPayments)
        );
      }
    } catch (error) {
      console.error("清理验证记录失败:", error);
      // 如果出错，尝试重置
      localStorage.removeItem("verifiedPayments");
    }
  };

  // 获取房间卡信息
  /* 注释掉获取房间卡信息相关代码
  useEffect(() => {
    const fetchRoomCards = async () => {
      if (!reservationId || !user) return;

      try {
        setIsLoadingCards(true);
        const idToken = await user.getIdToken();
        const response = await fetch(
          `/api/room-cards?reservationId=${reservationId}`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("カード情報の取得に失敗しました");
        }

        const data = await response.json();
        if (data.cards && Array.isArray(data.cards)) {
          setRoomCards(data.cards);
        }
      } catch (error) {
        console.error("Error fetching room cards:", error);
        // 获取卡信息失败不阻止页面显示
      } finally {
        setIsLoadingCards(false);
      }
    };

    if (reservationId) {
      fetchRoomCards();
    }
  }, [reservationId, user]);
  */

  if (isLoading || isVerifying) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12">
          <div className="text-center space-y-4">
            <p className="text-gray-600">支払い状態を確認中...</p>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-48 mx-auto"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12">
          <div className="text-center space-y-4">
            <p className="text-red-600">{error}</p>
            <p className="text-gray-600 text-sm">
              支払い処理は正常に完了している可能性があります。
              <br />
              予約一覧ページで状態をご確認ください。
            </p>
            <div className="space-y-4">
              <button
                onClick={() => router.push("/reservations")}
                className="px-6 py-2 bg-gray-700 text-white rounded-full text-sm hover:bg-gray-800"
              >
                予約一覧を確認
              </button>
              <br />
              <button
                onClick={() => router.push("/reservation/confirm")}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-full text-sm hover:bg-gray-300"
              >
                予約画面に戻る
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-[920px] mx-auto px-4 py-12">
        <div className="text-center space-y-8">
          <h1 className="text-2xl font-bold text-gray-700">
            ご予約ありがとうございます
          </h1>
          <p className="text-gray-700">
            予約が完了しました。
            <br />
            予約内容は予約一覧ページでご確認いただけます。
          </p>

          <div className="space-y-4 mt-8">
            <button
              onClick={() => router.push("/reservations")}
              className="px-6 py-2 bg-gray-700 text-white rounded-full text-sm hover:bg-gray-800"
            >
              予約一覧を確認
            </button>
            <br />
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2 bg-gray-600 text-white rounded-full text-sm hover:bg-gray-700"
            >
              トップページに戻る
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function ReservationComplete() {
  return (
    <Suspense
      fallback={
        <Layout>
          <div className="max-w-[920px] mx-auto px-4 py-12">
            <div className="text-center space-y-4">
              <p className="text-gray-600">読み込み中...</p>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-48 mx-auto"></div>
              </div>
            </div>
          </div>
        </Layout>
      }
    >
      <ReservationCompleteContent />
    </Suspense>
  );
}
