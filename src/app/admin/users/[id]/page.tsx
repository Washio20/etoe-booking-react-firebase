"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import { auth } from "@/utils/firebase";
import { User } from "@/types/user";
import { Reservation } from "@/types/reservation";
import { CouponUsage } from "@/types/coupon";
import { formatTimestamp } from "@/utils/date";

// 定义API响应接口
interface UserDetailsResponse {
  user: User;
  reservations: Reservation[];
  couponUsages: (CouponUsage & { couponName: string; couponCode: string })[];
}

export default function UserDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });
  
  const [userData, setUserData] = useState<User | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [couponUsages, setCouponUsages] = useState<(CouponUsage & { couponName: string; couponCode: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // 检查管理员权限
  useEffect(() => {
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
  
  // 加载用户详情数据
  useEffect(() => {
    if (!user || !adminState.isAdmin || !params.id) return;
    
    const fetchUserDetails = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/admin/users/${params.id}/details`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        
        if (response.ok) {
          const data: UserDetailsResponse = await response.json();
          setUserData(data.user);
          setReservations(data.reservations);
          setCouponUsages(data.couponUsages);
        } else {
          const errorData = await response.json();
          setErrorMessage(errorData.error || "ユーザー情報の取得に失敗しました");
        }
      } catch (error) {
        console.error("Error loading user details:", error);
        setErrorMessage("ユーザー情報の読み込み中にエラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserDetails();
  }, [user, adminState.isAdmin, params.id]);
  
  // 在组件内添加用于获取预约状态的辅助函数
  const getCouponStatus = (usage: CouponUsage & { couponName: string; couponCode: string }) => {
    if (usage.status === "pending") return "処理中";
    if (usage.status === "completed") return "完了";
    return "不明";
  };
  
  const getCouponStatusClass = (usage: CouponUsage & { couponName: string; couponCode: string }) => {
    if (usage.status === "pending") return "bg-yellow-100 text-yellow-800";
    if (usage.status === "completed") return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  };
  
  // 加载状态 - 用户加载中或权限检查未完成时显示
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
            onClick={() => router.push(`/login?returnTo=/admin/users/${params.id}`)}
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
              ユーザー詳細
            </h1>
            <button
              onClick={() => router.push("/admin/users")}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-300 transition-colors"
            >
              一覧に戻る
            </button>
          </div>
          
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700 text-sm font-zen-kaku-gothic">{errorMessage}</p>
            </div>
          )}
          
          {isLoading ? (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <p className="text-gray-500 font-zen-kaku-gothic text-center">
                ユーザー情報を読み込み中...
              </p>
            </div>
          ) : (
            <>
              {/* ユーザー基本情報 */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
                  基本情報
                </h2>
                
                {userData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <dl className="space-y-3">
                        <div className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500">名前</dt>
                          <dd className="text-sm text-gray-900 col-span-2">{userData.fullName || "-"}</dd>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500">メールアドレス</dt>
                          <dd className="text-sm text-gray-900 col-span-2">{userData.email}</dd>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500">メール認証</dt>
                          <dd className="text-sm text-gray-900 col-span-2">
                            <span
                              className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                userData.emailVerified ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}
                            >
                              {userData.emailVerified ? "認証済み" : "未認証"}
                            </span>
                          </dd>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500">性別</dt>
                          <dd className="text-sm text-gray-900 col-span-2">
                            {userData.gender === "male" ? "男性" : 
                             userData.gender === "female" ? "女性" : "-"}
                          </dd>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500">生年月日</dt>
                          <dd className="text-sm text-gray-900 col-span-2">{userData.birthdate || "-"}</dd>
                        </div>
                      </dl>
                    </div>
                    
                    <div>
                      <dl className="space-y-3">
                        <div className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500">電話番号</dt>
                          <dd className="text-sm text-gray-900 col-span-2">{userData.phone || "-"}</dd>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500">ユーザーID</dt>
                          <dd className="text-sm text-gray-900 col-span-2 break-all">{userData.uid}</dd>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500">登録日</dt>
                          <dd className="text-sm text-gray-900 col-span-2">{formatTimestamp(userData.createdAt)}</dd>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500">最終ログイン</dt>
                          <dd className="text-sm text-gray-900 col-span-2">{formatTimestamp(userData.lastLogin)}</dd>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <dt className="text-sm font-medium text-gray-500">最終更新</dt>
                          <dd className="text-sm text-gray-900 col-span-2">{formatTimestamp(userData.updatedAt)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 font-zen-kaku-gothic text-center">
                    ユーザー情報がありません
                  </p>
                )}
              </div>
              
              {/* 予約履歴 */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
                  予約履歴
                </h2>
                
                {reservations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">予約日</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">部屋タイプ</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">セットプラン</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">金額</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">支払い状況</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">予約日時</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reservations.map((reservation) => (
                          <tr key={reservation.id} className="hover:bg-gray-50">
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatTimestamp(reservation.bookingDate || reservation.reservationDate, "yyyy/MM/dd", "-")}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {reservation.roomType}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {reservation.slowRoomAsSetPlan ? (
                                "〇"
                              ) : "-"}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {typeof reservation.price === 'string' 
                                ? reservation.price 
                                : `${(Number(reservation.price) || 0).toLocaleString()}円`}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  reservation.paymentStatus === "paid" ? "bg-green-100 text-green-800" :
                                  reservation.paymentStatus === "cancelled" ? "bg-red-100 text-red-800" :
                                  "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {reservation.paymentStatus === "paid" ? "支払い済み" :
                                 reservation.paymentStatus === "cancelled" ? "キャンセル" : 
                                 reservation.paymentStatus || "未設定"}
                              </span>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatTimestamp(reservation.createdAt, "yyyy/MM/dd HH:mm", "-")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 font-zen-kaku-gothic text-center">
                    予約履歴はありません
                  </p>
                )}
              </div>
              
              {/* クーポン使用履歴 */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
                  クーポン使用履歴
                </h2>
                
                {couponUsages.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">使用日</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">クーポンコード</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">クーポン名</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">割引額</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">元の金額</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">最終金額</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">ステータス</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {couponUsages.map((usage) => (
                          <tr key={usage.id} className="hover:bg-gray-50">
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatTimestamp(usage.usedAt, "yyyy/MM/dd HH:mm", "-")}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {usage.couponCode}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {usage.couponName || "-"}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {(usage.discountAmount || 0).toLocaleString()}円
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {(usage.originalAmount || 0).toLocaleString()}円
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {(usage.finalAmount || 0).toLocaleString()}円
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCouponStatusClass(usage)}`}
                              >
                                {getCouponStatus(usage)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 font-zen-kaku-gothic text-center">
                    クーポン使用履歴はありません
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    </Layout>
  );
} 