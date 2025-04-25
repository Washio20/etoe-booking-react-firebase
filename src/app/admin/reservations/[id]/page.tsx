"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Reservation } from "@/types/reservation";
import { toDate } from "@/utils/date";
import Image from "next/image";

export default function ReservationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const reservationId = params.id;
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refundPercentage, setRefundPercentage] = useState(100); // 默认全额退款
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 修改为使用对象状态
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });

  const [roomAssignments, setRoomAssignments] = useState<any[]>([]);
  const [roomCards, setRoomCards] = useState<any[]>([]);
  const [loadingRoomData, setLoadingRoomData] = useState(false);

  // 部屋タイプのマッピング
  const roomTypeNames: Record<string, string> = {
    tototo: "TOTOTO",
    fuuu: "FUUU",
    zabuun: "ZABUUN",
    toron: "TORON",
    sauna_suite: "サウナスイート",
    slow_room: "スロールーム",
  };

  // 管理者権限をチェック
  useEffect(() => {
    // 如果还在加载用户状态，不执行检查
    if (loading) return;

    const checkAdminStatus = async () => {
      if (!user) {
        setAdminState({ isAdmin: false, checkComplete: true });
        return;
      }

      try {
        const idTokenResult = await user.getIdTokenResult(true);
        const isUserAdmin = idTokenResult.claims.admin === true;
        setAdminState({ isAdmin: isUserAdmin, checkComplete: true });
      } catch (error) {
        console.error("管理者権限チェックエラー:", error);
        setAdminState({ isAdmin: false, checkComplete: true });
      }
    };

    checkAdminStatus();
  }, [user, loading]);

  // 予約データを取得
  useEffect(() => {
    const fetchReservationDetail = async () => {
      if (!user || !adminState.isAdmin || !adminState.checkComplete) return;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const token = await user.getIdToken();

        const response = await fetch(
          `/api/admin/reservations/${reservationId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("予約データの取得に失敗しました");
        }

        const data = await response.json();
        setReservation(data.reservation);
      } catch (error) {
        console.error("予約詳細取得エラー:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "予約データの取得中にエラーが発生しました"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservationDetail();
  }, [user, adminState, reservationId]);

  // 获取房间分配和卡片信息
  useEffect(() => {
    const fetchRoomData = async () => {
      if (!user || !adminState.isAdmin || !adminState.checkComplete || !reservation) return;
      
      setLoadingRoomData(true);
      
      try {
        const token = await user.getIdToken();
        
        // 获取房间分配信息
        const assignmentsResponse = await fetch(
          `/api/admin/room-assignments?reservationId=${reservationId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        if (assignmentsResponse.ok) {
          const assignmentsData = await assignmentsResponse.json();
          setRoomAssignments(assignmentsData.assignments || []);
        }
        
        // 获取卡片信息
        const cardsResponse = await fetch(
          `/api/admin/cards?reservationId=${reservationId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        if (cardsResponse.ok) {
          const cardsData = await cardsResponse.json();
          setRoomCards(cardsData.cards || []);
        }
      } catch (error) {
        console.error("部屋・カード情報取得エラー:", error);
      } finally {
        setLoadingRoomData(false);
      }
    };
    
    fetchRoomData();
  }, [user, adminState, reservationId, reservation]);

  // キャンセルモーダルを開く
  const handleOpenCancelModal = () => {
    setIsCancelModalOpen(true);
  };

  // キャンセルモーダルを閉じる
  const handleCloseCancelModal = () => {
    setIsCancelModalOpen(false);
  };

  // 予約をキャンセルする処理
  // const handleCancelReservation = async () => {
  //   if (!confirm("この予約をキャンセルしてもよろしいですか？")) {
  //     return;
  //   }

  //   setIsSubmitting(true);

  //   try {
  //     const token = await user?.getIdToken();

  //     const response = await fetch(
  //       `/api/admin/reservations/${reservationId}/cancel`,
  //       {
  //         method: "POST",
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify({ refundPercentage }),
  //       }
  //     );

  //     if (!response.ok) {
  //       throw new Error("予約のキャンセルに失敗しました");
  //     }

  //     const result = await response.json();

  //     // 成功したら予約データを更新
  //     setReservation((prev) =>
  //       prev
  //         ? {
  //             ...prev,
  //             paymentStatus: "cancelled",
  //             refund: result.refund,
  //           }
  //         : null
  //     );

  //     setIsCancelModalOpen(false);
  //     alert("予約をキャンセルしました");
  //   } catch (error) {
  //     console.error("キャンセルエラー:", error);
  //     alert(
  //       error instanceof Error
  //         ? error.message
  //         : "予約のキャンセル処理中にエラーが発生しました"
  //     );
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  // 予約を削除する処理
  // const handleDeleteReservation = async () => {
  //   if (
  //     !confirm("この予約を削除してもよろしいですか？この操作は元に戻せません。")
  //   ) {
  //     return;
  //   }

  //   try {
  //     const token = await user?.getIdToken();

  //     const response = await fetch(`/api/admin/reservations/${reservationId}`, {
  //       method: "DELETE",
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //       },
  //     });

  //     if (!response.ok) {
  //       throw new Error("予約の削除に失敗しました");
  //     }

  //     alert("予約を削除しました");
  //     // 削除成功後、一覧ページに戻る
  //     router.push("/admin/reservations");
  //   } catch (error) {
  //     console.error("削除エラー:", error);
  //     alert(
  //       error instanceof Error
  //         ? error.message
  //         : "予約の削除処理中にエラーが発生しました"
  //     );
  //   }
  // };

  // 房间类型编号格式化
  const formatRoomNumber = (physicalRoomId: string) => {
    return physicalRoomId.replace('room_', '');
  };

  // ローディング表示
  if (loading || !adminState.checkComplete) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </Layout>
    );
  }

  // 未ログイン時の表示
  if (!user) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic mb-4">
            管理者ページにアクセスするには、ログインしてください。
          </p>
          <button
            onClick={() =>
              router.push(
                `/login?returnTo=/admin/reservations/${reservationId}`
              )
            }
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
          >
            ログイン
          </button>
        </div>
      </Layout>
    );
  }

  // 管理者権限がない場合の表示
  if (!adminState.isAdmin) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic">
            このページにアクセスする権限がありません。
          </p>
        </div>
      </Layout>
    );
  }

  // 取消モーダル
  // const renderCancelModal = () => {
  //   if (!isCancelModalOpen || !reservation) return null;

  //   return (
  //     <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
  //       <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
  //         <h3 className="text-lg font-bold mb-4 font-zen-kaku-gothic">
  //           予約キャンセル
  //         </h3>

  //         <p className="text-sm text-gray-600 mb-4 font-zen-kaku-gothic">
  //           この予約をキャンセルします。返金率を選択してください。
  //         </p>

  //         <div className="mb-6">
  //           <label className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic">
  //             返金率
  //           </label>
  //           <div className="flex items-center mb-4">
  //             <input
  //               type="range"
  //               min="0"
  //               max="100"
  //               step="10"
  //               value={refundPercentage}
  //               onChange={(e) => setRefundPercentage(parseInt(e.target.value))}
  //               className="w-full"
  //             />
  //             <span className="ml-2 text-sm font-zen-kaku-gothic">
  //               {refundPercentage}%
  //             </span>
  //           </div>

  //           <div className="text-sm bg-gray-50 p-3 rounded border border-gray-200 font-zen-kaku-gothic">
  //             <p>料金: ¥{parseInt(reservation.price).toLocaleString()}</p>
  //             <p>
  //               返金額: ¥
  //               {Math.floor(
  //                 (parseInt(reservation.price) * refundPercentage) / 100
  //               ).toLocaleString()}
  //             </p>
  //             <p>
  //               キャンセル料: ¥
  //               {Math.floor(
  //                 (parseInt(reservation.price) * (100 - refundPercentage)) / 100
  //               ).toLocaleString()}
  //             </p>
  //           </div>
  //         </div>

  //         <div className="flex justify-end space-x-2">
  //           <button
  //             onClick={handleCloseCancelModal}
  //             className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-zen-kaku-gothic"
  //             disabled={isSubmitting}
  //           >
  //             キャンセル
  //           </button>
  //           {/* <button
  //             onClick={handleCancelReservation}
  //             className="px-4 py-2 bg-red-600 text-white rounded text-sm font-zen-kaku-gothic"
  //             disabled={isSubmitting}
  //           >
  //             {isSubmitting ? "処理中..." : "予約をキャンセルする"}
  //           </button> */}
  //         </div>
  //       </div>
  //     </div>
  //   );
  // };

  return (
    <Layout>
      <AdminLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-300 pb-4 flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wider font-zen-kaku-gothic">
              予約詳細
            </h1>
            <button
              onClick={() => router.push("/admin/reservations")}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-300 transition-colors"
            >
              一覧に戻る
            </button>
          </div>

          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 font-zen-kaku-gothic">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 予約詳細 */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-600 font-zen-kaku-gothic">
                予約データを読み込み中...
              </p>
            </div>
          ) : !reservation ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 font-zen-kaku-gothic">
                予約データが見つかりませんでした
              </p>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              {/* 予約ID情報 */}
              <div className="mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 mb-1 font-zen-kaku-gothic">
                      予約ID
                    </h2>
                    <p className="text-gray-700 break-all font-zen-kaku-gothic">
                      {reservation.id}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                        reservation.paymentStatus === "paid"
                          ? "bg-green-100 text-green-800"
                          : reservation.paymentStatus === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {reservation.paymentStatus === "paid"
                        ? "支払い済み"
                        : reservation.paymentStatus === "cancelled"
                        ? "キャンセル"
                        : reservation.paymentStatus}
                    </span>
                  </div>
                </div>
                {reservation.createdAt && (
                  <p className="text-sm text-gray-500 mt-2 font-zen-kaku-gothic">
                    予約日時:{" "}
                    {format(
                      toDate(reservation.createdAt) || new Date(),
                      "yyyy年MM月dd日 HH:mm",
                      { locale: ja }
                    )}
                  </p>
                )}
              </div>

              {/* 顧客情報 */}
              <div className="mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-3 font-zen-kaku-gothic">
                  顧客情報
                </h2>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                      メールアドレス:
                    </div>
                    <div className="md:col-span-2 text-gray-700 break-all font-zen-kaku-gothic">
                      {reservation.userEmail}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                      ユーザーID:
                    </div>
                    <div className="md:col-span-2 text-gray-700 break-all font-zen-kaku-gothic">
                      {reservation.userId}
                    </div>
                  </div>
                </div>
              </div>

              {/* 予約詳細 */}
              <div className="mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-3 font-zen-kaku-gothic">
                  予約詳細
                </h2>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                      日付:
                    </div>
                    <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                      {reservation.displayDate ||
                        reservation.reservationDate ||
                        ""}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                      時間:
                    </div>
                    <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                      {reservation.displayTimeRange ||
                        reservation.reservationTime ||
                        ""}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                      部屋タイプ:
                    </div>
                    <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                      {roomTypeNames[reservation.roomType] ||
                        reservation.roomType}
                    </div>
                  </div>
                  {reservation.slowRoomAsSetPlan && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                        スロールーム:
                      </div>
                      <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                        {reservation.displaySlowRoomTimeRange ||
                          "時間データなし"}
                        {reservation.slowRoomStartDateTime &&
                          reservation.slowRoomEndDateTime && (
                            <span className="block text-xs text-gray-500">
                              (
                              {format(
                                toDate(reservation.slowRoomStartDateTime) ||
                                  new Date(),
                                "HH:mm",
                                { locale: ja }
                              )}
                              〜
                              {format(
                                toDate(reservation.slowRoomEndDateTime) ||
                                  new Date(),
                                "HH:mm",
                                { locale: ja }
                              )}
                              )
                            </span>
                          )}
                      </div>
                    </div>
                  )}
                  {reservation.plan && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                        プラン:
                      </div>
                      <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                        {reservation.plan}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 支払い情報 */}
              <div className="mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-3 font-zen-kaku-gothic">
                  支払い情報
                </h2>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                      金額:
                    </div>
                    <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                      ¥{parseInt(String(reservation.price)).toLocaleString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                      支払い状況:
                    </div>
                    <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                      {reservation.paymentStatus === "paid"
                        ? "支払い済み"
                        : reservation.paymentStatus === "cancelled"
                        ? "キャンセル"
                        : reservation.paymentStatus}
                    </div>
                  </div>
                  {reservation.paymentId && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                        決済ID:
                      </div>
                      <div className="md:col-span-2 text-gray-700 break-all font-zen-kaku-gothic">
                        {reservation.paymentId}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 返金情報（キャンセル済みの場合） */}
              {reservation.paymentStatus === "cancelled" && (
                <div className="mb-6 pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 font-zen-kaku-gothic">
                    キャンセル情報
                  </h2>
                  <div className="space-y-2">
                    {reservation.cancelledAt && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                          キャンセル日時:
                        </div>
                        <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                          {format(
                            toDate(reservation.cancelledAt) || new Date(),
                            "yyyy年MM月dd日 HH:mm",
                            { locale: ja }
                          )}
                        </div>
                      </div>
                    )}

                    {reservation.cancelledBy && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                          キャンセル実行:
                        </div>
                        <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                          {reservation.cancelledBy.type === "user"
                            ? "ユーザー"
                            : "管理者"}
                          （{reservation.cancelledBy.email}）
                        </div>
                      </div>
                    )}

                    {reservation.refund && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                            返金ID:
                          </div>
                          <div className="md:col-span-2 text-gray-700 break-all font-zen-kaku-gothic">
                            {reservation.refund.id || "不明"}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                            返金額:
                          </div>
                          <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                            ¥
                            {Math.floor(
                              reservation.refund.amount / 100
                            ).toLocaleString()}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                            返金状態:
                          </div>
                          <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                            {reservation.refund.status === "processed"
                              ? "処理済み"
                              : reservation.refund.status === "pending"
                              ? "処理中"
                              : reservation.refund.status || "不明"}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                            返金日時:
                          </div>
                          <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                            {(() => {
                              try {
                                // 使用toDate辅助函数统一处理所有日期类型
                                const dateObj = toDate(
                                  reservation.refund.createdAt
                                );
                                if (dateObj) {
                                  return format(
                                    dateObj,
                                    "yyyy年MM月dd日 HH:mm",
                                    { locale: ja }
                                  );
                                }

                                // 如果无法处理，返回原始值
                                return String(reservation.refund.createdAt);
                              } catch (e) {
                                console.error("日付フォーマットエラー:", e);
                                return "日付データエラー";
                              }
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* システム情報 */}
              <div className="mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-3 font-zen-kaku-gothic">
                  システム情報
                </h2>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                      作成日時:
                    </div>
                    <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                      {reservation.createdAt
                        ? format(
                            toDate(reservation.createdAt) || new Date(),
                            "yyyy年MM月dd日 HH:mm:ss",
                            { locale: ja }
                          )
                        : "不明"}
                    </div>
                  </div>
                  {reservation.updatedAt && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                        更新日時:
                      </div>
                      <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                        {format(
                          toDate(reservation.updatedAt) || new Date(),
                          "yyyy年MM月dd日 HH:mm:ss",
                          { locale: ja }
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 部屋割り当て情報 */}
              {roomAssignments.length > 0 && (
                <div className="mb-6 pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 font-zen-kaku-gothic">
                    部屋割り当て情報
                  </h2>
                  <div className="space-y-4">
                    {roomAssignments.map((assignment, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                          <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                            部屋タイプ:
                          </div>
                          <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                            {roomTypeNames[assignment.roomType] || assignment.roomType}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                          <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                            部屋番号:
                          </div>
                          <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                            {formatRoomNumber(assignment.physicalRoomId)}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                            利用時間:
                          </div>
                          <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                            {(() => {
                              // 调试信息
                              console.log("房间分配数据:", JSON.stringify(assignment));
                              
                              // 检查可能的时间字段名
                              const possibleStartFields = ['startAt', 'startDateTime', 'start_at', 'startTime'];
                              const possibleEndFields = ['endAt', 'endDateTime', 'end_at', 'endTime'];
                              
                              // 查找可用的开始时间字段
                              let startTimeValue = null;
                              for (const field of possibleStartFields) {
                                if (assignment[field]) {
                                  startTimeValue = assignment[field];
                                  console.log(`找到开始时间字段: ${field}`, startTimeValue);
                                  break;
                                }
                              }
                              
                              // 查找可用的结束时间字段
                              let endTimeValue = null;
                              for (const field of possibleEndFields) {
                                if (assignment[field]) {
                                  endTimeValue = assignment[field];
                                  console.log(`找到结束时间字段: ${field}`, endTimeValue);
                                  break;
                                }
                              }
                              
                              if (!startTimeValue || !endTimeValue) {
                                return "時間情報なし (利用可能なフィールドが見つかりません)";
                              }
                              
                              try {
                                // 处理不同类型的时间戳
                                const formatAssignmentDate = (dateValue: any) => {
                                  if (!dateValue) return null;
                                  
                                  console.log("处理日期值:", typeof dateValue, dateValue);
                                  
                                  // 处理Firestore时间戳对象
                                  if (typeof dateValue === 'object') {
                                    if (dateValue.seconds || dateValue._seconds) {
                                      const seconds = dateValue.seconds || dateValue._seconds;
                                      return new Date(seconds * 1000);
                                    }
                                    
                                    // 检查nanoseconds字段 - Firestore Timestamp的另一种形式
                                    if (dateValue.nanoseconds !== undefined) {
                                      const seconds = dateValue.seconds || 0;
                                      return new Date(seconds * 1000);
                                    }
                                    
                                    // 如果是Date对象
                                    if (dateValue instanceof Date) {
                                      return dateValue;
                                    }
                                    
                                    // 尝试toDate方法 - Firestore Timestamp
                                    if (typeof dateValue.toDate === 'function') {
                                      return dateValue.toDate();
                                    }
                                  }
                                  
                                  // 处理ISO字符串
                                  if (typeof dateValue === 'string') {
                                    const date = new Date(dateValue);
                                    if (!isNaN(date.getTime())) {
                                      return date;
                                    }
                                  }
                                  
                                  // 处理数字时间戳（毫秒）
                                  if (typeof dateValue === 'number') {
                                    return new Date(dateValue);
                                  }
                                  
                                  return null;
                                };
                                
                                const startDate = formatAssignmentDate(startTimeValue);
                                const endDate = formatAssignmentDate(endTimeValue);
                                
                                console.log("转换后的日期:", startDate, endDate);
                                
                                if (!startDate || !endDate) {
                                  console.error("无效的分配日期格式:", startTimeValue, endTimeValue);
                                  return "時間情報の形式が無効です";
                                }
                                
                                return (
                                  <>
                                    {format(startDate, "yyyy年MM月dd日", { locale: ja })}
                                    {" "}
                                    {format(startDate, "HH:mm", { locale: ja })}
                                    {" 〜 "}
                                    {format(endDate, "HH:mm", { locale: ja })}
                                  </>
                                );
                              } catch (error) {
                                console.error("分配日期格式化错误:", error, assignment);
                                return "時間情報の処理中にエラーが発生しました";
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 入室カード情報 */}
              {roomCards.length > 0 && (
                <div className="mb-6 pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 font-zen-kaku-gothic">
                    入室カード情報
                  </h2>
                  <div className="space-y-6">
                    {roomCards.map((card, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-md">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="mb-3">
                              <span className="text-sm text-gray-500 font-zen-kaku-gothic block mb-1">
                                部屋番号:
                              </span>
                              <span className="text-gray-700 font-zen-kaku-gothic font-medium">
                                {formatRoomNumber(card.physicalRoomId)} 
                              </span>
                            </div>
                            <div className="mb-3">
                              <span className="text-sm text-gray-500 font-zen-kaku-gothic block mb-1">
                                カード番号:
                              </span>
                              <span className="text-gray-700 font-zen-kaku-gothic break-all">
                                {card.cardNumber}
                              </span>
                            </div>
                            <div className="mb-3">
                              <span className="text-sm text-gray-500 font-zen-kaku-gothic block mb-1">
                                有効期間:
                              </span>
                              <span className="text-gray-700 font-zen-kaku-gothic">
                                {(() => {
                                  // 调试信息
                                  console.log("卡片数据:", JSON.stringify(card));
                                  
                                  // 检查可能的时间字段名
                                  const possibleStartFields = ['startAt', 'startDateTime', 'start_at', 'startTime', 'validFrom'];
                                  const possibleEndFields = ['endAt', 'endDateTime', 'end_at', 'endTime', 'validUntil'];
                                  
                                  // 查找可用的开始时间字段
                                  let startTimeValue = null;
                                  for (const field of possibleStartFields) {
                                    if (card[field]) {
                                      startTimeValue = card[field];
                                      console.log(`找到卡片开始时间字段: ${field}`, startTimeValue);
                                      break;
                                    }
                                  }
                                  
                                  // 查找可用的结束时间字段
                                  let endTimeValue = null;
                                  for (const field of possibleEndFields) {
                                    if (card[field]) {
                                      endTimeValue = card[field];
                                      console.log(`找到卡片结束时间字段: ${field}`, endTimeValue);
                                      break;
                                    }
                                  }
                                  
                                  if (!startTimeValue || !endTimeValue) {
                                    return "時間情報なし (利用可能なフィールドが見つかりません)";
                                  }
                                  
                                  try {
                                    // 处理不同类型的时间戳
                                    const formatCardDate = (dateValue: any) => {
                                      if (!dateValue) return null;
                                      
                                      console.log("处理卡片日期值:", typeof dateValue, dateValue);
                                      
                                      // 处理Firestore时间戳对象
                                      if (typeof dateValue === 'object') {
                                        if (dateValue.seconds || dateValue._seconds) {
                                          const seconds = dateValue.seconds || dateValue._seconds;
                                          return new Date(seconds * 1000);
                                        }
                                        
                                        // 检查nanoseconds字段 - Firestore Timestamp的另一种形式
                                        if (dateValue.nanoseconds !== undefined) {
                                          const seconds = dateValue.seconds || 0;
                                          return new Date(seconds * 1000);
                                        }
                                        
                                        // 如果是Date对象
                                        if (dateValue instanceof Date) {
                                          return dateValue;
                                        }
                                        
                                        // 尝试toDate方法 - Firestore Timestamp
                                        if (typeof dateValue.toDate === 'function') {
                                          return dateValue.toDate();
                                        }
                                      }
                                      
                                      // 处理ISO字符串
                                      if (typeof dateValue === 'string') {
                                        const date = new Date(dateValue);
                                        if (!isNaN(date.getTime())) {
                                          return date;
                                        }
                                      }
                                      
                                      // 处理数字时间戳（毫秒）
                                      if (typeof dateValue === 'number') {
                                        return new Date(dateValue);
                                      }
                                      
                                      return null;
                                    };
                                    
                                    const startDate = formatCardDate(startTimeValue);
                                    const endDate = formatCardDate(endTimeValue);
                                    
                                    console.log("转换后的卡片日期:", startDate, endDate);
                                    
                                    if (!startDate || !endDate) {
                                      console.error("无效的卡片日期格式:", startTimeValue, endTimeValue);
                                      return "時間情報の形式が無効です";
                                    }
                                    
                                    // 使用format格式化日期
                                    return (
                                      <>
                                        {format(startDate, "yyyy年MM月dd日", { locale: ja })}
                                        {" "}
                                        {format(startDate, "HH:mm", { locale: ja })}
                                        {" 〜 "}
                                        {format(endDate, "HH:mm", { locale: ja })}
                                      </>
                                    );
                                  } catch (error) {
                                    console.error("卡片日期格式化错误:", error, card);
                                    return "時間情報の処理中にエラーが発生しました";
                                  }
                                })()}
                              </span>
                            </div>
                            <div className="mb-3">
                              <span className="text-sm text-gray-500 font-zen-kaku-gothic block mb-1">
                                メール送信状況:
                              </span>
                              <span className={`text-sm font-medium ${reservation.cardEmailSent ? 'text-green-600' : 'text-orange-500'}`}>
                                {reservation.cardEmailSent ? '✓ 送信済み' : '未送信'}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-center justify-center">
                            {card.barcode && (
                              <div className="text-center">
                                <span className="text-sm text-gray-500 font-zen-kaku-gothic block mb-2">
                                  入室用バーコード:
                                </span>
                                {card.barcode.startsWith('data:image') ? (
                                  <Image
                                    src={card.barcode}
                                    alt="バーコード"
                                    width={300}
                                    height={100}
                                    className="max-w-full h-auto mx-auto"
                                  />
                                ) : (
                                  <div 
                                    dangerouslySetInnerHTML={{ __html: card.barcode }}
                                    className="max-w-full overflow-auto"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {loadingRoomData && (
                <div className="mb-6 text-center py-4">
                  <p className="text-gray-500 font-zen-kaku-gothic">
                    部屋・カード情報を読み込み中...
                  </p>
                </div>
              )}

              {!loadingRoomData && roomAssignments.length === 0 && (
                <div className="mb-6 pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 font-zen-kaku-gothic">
                    部屋割り当て情報
                  </h2>
                  <p className="text-gray-500 font-zen-kaku-gothic py-2">
                    まだ部屋が割り当てられていません
                  </p>
                </div>
              )}

              {/* 操作ボタン */}
              <div className="flex justify-end space-x-3">
                {/* {reservation.paymentStatus === "paid" && (
                  <button
                    onClick={handleOpenCancelModal}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-zen-kaku-gothic hover:bg-red-200 transition-colors"
                  >
                    予約をキャンセル
                  </button>
                )} */}
                {/* <button
                  onClick={handleDeleteReservation}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-800 transition-colors"
                >
                  予約を削除
                </button> */}
                
                {roomAssignments.length > 0 && !reservation.cardEmailSent && (
                  <button
                    onClick={() => router.push(`/admin/card-issue?email=${reservation.userEmail}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-blue-700 transition-colors"
                  >
                    カード情報をメール送信
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {/* {renderCancelModal()} */}
      </AdminLayout>
    </Layout>
  );
}

