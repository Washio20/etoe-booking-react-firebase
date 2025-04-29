"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import { auth } from "@/utils/firebase";
import { Coupon, CouponDiscountType } from "@/types/coupon";
import { formatTimestamp } from "@/utils/date";

export default function AdminCoupons() {
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
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
  
  // 加载优惠券列表
  const loadCoupons = useCallback(async () => {
    if (!user || !adminState.isAdmin) return;
    
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/coupons", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setCoupons(data.coupons || []);
        setCurrentPage(1);
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.error || "クーポン情報の取得に失敗しました");
      }
    } catch (error) {
      console.error("Error loading coupons:", error);
      setErrorMessage("クーポン情報の読み込み中にエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }, [user, adminState.isAdmin]);
  
  // 初始加载
  useEffect(() => {
    if (adminState.isAdmin) {
      loadCoupons();
    }
  }, [adminState.isAdmin, loadCoupons]);
  
  // 处理创建新优惠券
  const handleCreateCoupon = () => {
    router.push("/admin/coupons/create");
  };
  
  // 计算分页数据
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCoupons = coupons.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(coupons.length / itemsPerPage);
  
  // 切换页面
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  
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
            onClick={() => router.push("/login?returnTo=/admin/coupons")}
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
          <div className="border-b border-gray-300 pb-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wider font-zen-kaku-gothic">
              クーポン管理
            </h1>
          </div>
          
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700 text-sm font-zen-kaku-gothic">{errorMessage}</p>
            </div>
          )}
          
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex justify-between items-center bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-800 font-zen-kaku-gothic">
                クーポン一覧
              </h2>
              <div className="flex flex-row space-x-2">
                <button
                  onClick={() => router.push("/admin/coupon-analytics")}
                  className="px-2 py-1.5 bg-teal-500 text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-teal-600 transition-colors flex items-center justify-center"
                >
                  使用分析
                </button>
                <button
                  onClick={handleCreateCoupon}
                  className="px-2 py-1.5 bg-[#444444] text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-[#333333] transition-colors flex items-center justify-center"
                >
                  新規作成
                </button>
              </div>
            </div>
            
            {isLoading ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 font-zen-kaku-gothic">
                  データを読み込み中...
                </p>
              </div>
            ) : coupons.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 font-zen-kaku-gothic">
                  クーポンはまだありません
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        コード
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        クーポン名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        割引内容
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        有効期間
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        使用状況
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状態
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentCoupons.map((coupon) => (
                      <tr key={coupon.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {coupon.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {coupon.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {coupon.discountType === "fixed"
                            ? `${coupon.discountValue.toLocaleString()}円引き`
                            : `${coupon.discountValue}%オフ`}
                          {coupon.minAmount > 0 && ` (${coupon.minAmount.toLocaleString()}円以上)`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimestamp(coupon.validFrom, "yyyy/MM/dd HH:mm")} 〜 
                          <br />
                          {formatTimestamp(coupon.validTo, "yyyy/MM/dd HH:mm")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {coupon.usedCount || 0} / {coupon.usageLimit === -1 ? "∞" : coupon.usageLimit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span 
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              coupon.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {coupon.isActive ? "有効" : "無効"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => router.push(`/admin/coupons/edit/${coupon.id}`)}
                              className="text-sm px-3 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                            >
                              修改
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {totalPages > 1 && (
                  <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                          currentPage === 1
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        前へ
                      </button>
                      <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                          currentPage === totalPages
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        次へ
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          全 <span className="font-medium">{coupons.length}</span> 件中{" "}
                          <span className="font-medium">{indexOfFirstItem + 1}</span> から{" "}
                          <span className="font-medium">
                            {Math.min(indexOfLastItem, coupons.length)}
                          </span> 件を表示
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                              currentPage === 1
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <span className="sr-only">前へ</span>
                            &laquo;
                          </button>
                          {[...Array(totalPages)].map((_, i) => (
                            <button
                              key={i}
                              onClick={() => paginate(i + 1)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === i + 1
                                  ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                  : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                          <button
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                              currentPage === totalPages
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <span className="sr-only">次へ</span>
                            &raquo;
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </Layout>
  );
}