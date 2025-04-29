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
import { toDate, formatTimestamp, convertToDate } from "@/utils/date";
import Image from "next/image";
import { Coupon } from "@/types/coupon";

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
  const [couponDetail, setCouponDetail] = useState<Coupon | null>(null);
  const [loadingCoupon, setLoadingCoupon] = useState(false);

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
        
        // 如果存在优惠券ID，获取优惠券详细信息
        if (data.reservation.couponId) {
          await fetchCouponDetail(data.reservation.couponId, token);
        }
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

  // 获取优惠券详细信息
  const fetchCouponDetail = async (couponId: string, token: string) => {
    if (!couponId) return;
    
    setLoadingCoupon(true);
    
    try {
      const response = await fetch(`/api/admin/coupons/${couponId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setCouponDetail(data.coupon);
      } else {
        console.error("优惠券信息获取失败");
      }
    } catch (error) {
      console.error("获取优惠券详情时出错:", error);
    } finally {
      setLoadingCoupon(false);
    }
  };

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
          console.log("房间分配数据:", assignmentsData);
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
                    {formatTimestamp(reservation.createdAt, "yyyy年MM月dd日 HH:mm", "不明")}
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
                      お名前:
                    </div>
                    <div className="md:col-span-2 text-gray-700 break-all font-zen-kaku-gothic">
                      {reservation.userFullName || "未設定"}
                    </div>
                  </div>
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
                              {formatTimestamp(reservation.slowRoomStartDateTime, "HH:mm")}
                              〜
                              {formatTimestamp(reservation.slowRoomEndDateTime, "HH:mm")}
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
                  
                  {/* 优惠券信息部分 */}
                  {reservation.couponId && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                          クーポン:
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-gray-700 font-zen-kaku-gothic">
                            <span className="text-blue-600">{reservation.couponId}</span>
                            {loadingCoupon && (
                              <span className="ml-2 text-xs text-gray-500">読み込み中...</span>
                            )}
                          </div>
                          
                          {couponDetail && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-md text-sm">
                              <p className="font-medium text-gray-800 mb-1">{couponDetail.name}</p>
                              <p className="text-gray-600 mb-2">{couponDetail.description}</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-500">種類:</span>{" "}
                                  <span className="font-medium">
                                    {couponDetail.discountType === 'fixed' ? '定額割引' : 'パーセント割引'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">値:</span>{" "}
                                  <span className="font-medium">
                                    {couponDetail.discountType === 'fixed' 
                                      ? `${couponDetail.discountValue.toLocaleString()}円` 
                                      : `${couponDetail.discountValue}%`}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">コード:</span>{" "}
                                  <span className="font-medium">{couponDetail.code}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">使用状態:</span>{" "}
                                  <span className={`font-medium ${couponDetail.isActive ? 'text-green-600' : 'text-red-600'}`}>
                                    {couponDetail.isActive ? '有効' : '無効'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {reservation.discountAmount && reservation.discountAmount > 0 && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                              割引前:
                            </div>
                            <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                              ¥{(parseInt(String(reservation.price)) + parseInt(String(reservation.discountAmount))).toLocaleString()}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                              割引額:
                            </div>
                            <div className="md:col-span-2 text-red-600 font-zen-kaku-gothic">
                              -¥{parseInt(String(reservation.discountAmount)).toLocaleString()}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  
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
                          {reservation.cancelledAt 
                            ? formatTimestamp(reservation.cancelledAt, "yyyy年MM月dd日 HH:mm", "不明")
                            : "不明"}
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
                                return formatTimestamp(reservation.refund.createdAt, "yyyy年MM月dd日 HH:mm", "日付情報なし");
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
                      {formatTimestamp(reservation.createdAt, "yyyy年MM月dd日 HH:mm:ss", "不明")}
                    </div>
                  </div>
                  {reservation.updatedAt && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="text-sm text-gray-500 font-zen-kaku-gothic">
                        更新日時:
                      </div>
                      <div className="md:col-span-2 text-gray-700 font-zen-kaku-gothic">
                        {formatTimestamp(reservation.updatedAt, "yyyy年MM月dd日 HH:mm:ss", "不明")}
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
                              try {
                                // 直接使用startDateTime和endDateTime字段，这是数据库中实际存在的字段
                                if (assignment.startDateTime && assignment.endDateTime) {
                                  const startDate = convertToDate(assignment.startDateTime);
                                  const endDate = convertToDate(assignment.endDateTime);
                                  
                                  if (startDate && endDate) {
                                    return (
                                      <>
                                        {format(startDate, "yyyy年MM月dd日", { locale: ja })}
                                        {" "}
                                        {format(startDate, "HH:mm", { locale: ja })}
                                        {" 〜 "}
                                        {format(endDate, "HH:mm", { locale: ja })}
                                      </>
                                    );
                                  }
                                }
                                
                                // 如果没有可用的日期时间数据
                                console.log("日時データがありません:", assignment);
                                return "時間情報がありません";
                              } catch (error) {
                                console.error("日付フォーマットエラー:", error, assignment);
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
                                  try {
                                    // 直接使用startAt和endAt字段，这是数据库中实际存在的字段
                                    if (card.startAt && card.endAt) {
                                      const startDate = convertToDate(card.startAt);
                                      const endDate = convertToDate(card.endAt);
                                      
                                      if (startDate && endDate) {
                                        // 日付をフォーマット
                                        return (
                                          <>
                                            {format(startDate, "yyyy年MM月dd日", { locale: ja })}
                                            {" "}
                                            {format(startDate, "HH:mm", { locale: ja })}
                                            {" 〜 "}
                                            {format(endDate, "HH:mm", { locale: ja })}
                                          </>
                                        );
                                      }
                                    }
                                    
                                    // 如果没有可用的日期时间数据
                                    console.log("カード日時データがありません:", card);
                                    return "カード有効期間情報がありません";
                                  } catch (error) {
                                    console.error("カード日付フォーマットエラー:", error, card);
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

