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

export default function ReservationsPage() {
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 修改为使用对象状态
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });

  // 検索・フィルター用の状態
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
    const fetchReservations = async () => {
      if (!user || !adminState.isAdmin || !adminState.checkComplete) return;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const token = await user.getIdToken();

        const response = await fetch("/api/admin/reservations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("予約データの取得に失敗しました");
        }

        const data = await response.json();
        setReservations(data.reservations);
      } catch (error) {
        console.error("予約取得エラー:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "予約データの取得中にエラーが発生しました"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, [user, adminState]);

  // フィルター処理済みの予約リスト
  const filteredReservations = reservations.filter((reservation) => {
    // 検索語句でフィルタリング（メールアドレスなど）
    const searchMatches =
      reservation.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.id.toLowerCase().includes(searchTerm.toLowerCase());

    // ステータスでフィルタリング
    const statusMatches =
      statusFilter === "all" || reservation.paymentStatus === statusFilter;

    // 日付でフィルタリング（displayDateまたはreservationDateを使用）
    const dateToCheck =
      reservation.displayDate || reservation.reservationDate || "";
    const dateMatches = !dateFilter || dateToCheck.includes(dateFilter);

    // 部屋タイプでフィルタリング
    const roomTypeMatches =
      roomTypeFilter === "all" || reservation.roomType === roomTypeFilter;

    return searchMatches && statusMatches && dateMatches && roomTypeMatches;
  });

  // 日付でソート（新しい順）
  const sortedReservations = [...filteredReservations].sort((a, b) => {
    // createdAtがFirestoreのTimestampオブジェクトの場合の対応
    const dateA = toDate(a.createdAt) || new Date();
    const dateB = toDate(b.createdAt) || new Date();
    return dateB.getTime() - dateA.getTime();
  });
  
  // 分页计算
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentReservations = sortedReservations.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedReservations.length / itemsPerPage);
  
  // 切换页面的函数
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  
  // 搜索或筛选条件变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, roomTypeFilter]);
  
  // 改变每页显示数量
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // 重置到第一页
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
            onClick={() => router.push("/login?returnTo=/admin/reservations")}
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
              予約管理
            </h1>
          </div>

          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
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

          {/* 検索・フィルター */}
          <div className="bg-white p-4 border border-gray-200 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="search"
                  className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                >
                  検索
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="メールアドレスなど"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="statusFilter"
                  className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                >
                  ステータス
                </label>
                <select
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                >
                  <option value="all">すべて</option>
                  <option value="paid">支払い済み</option>
                  <option value="cancelled">キャンセル済み</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="dateFilter"
                  className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                >
                  予約日
                </label>
                <input
                  type="text"
                  id="dateFilter"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  placeholder="例: 2025年4月13日"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="roomTypeFilter"
                  className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                >
                  部屋タイプ
                </label>
                <select
                  id="roomTypeFilter"
                  value={roomTypeFilter}
                  onChange={(e) => setRoomTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                >
                  <option value="all">すべて</option>
                  <option value="tototo">TOTOTO</option>
                  <option value="fuuu">FUUU</option>
                  <option value="zabuun">ZABUUN</option>
                  <option value="toron">TORON</option>
                  <option value="sauna_suite">サウナスイート</option>
                  <option value="slow_room">スロールーム</option>
                </select>
              </div>
            </div>
          </div>

          {/* 予約リスト */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-600 font-zen-kaku-gothic">
                予約データを読み込み中...
              </p>
            </div>
          ) : sortedReservations.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 font-zen-kaku-gothic">
                予約データがありません
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-700 font-zen-kaku-gothic">
                  全 <span className="font-medium">{sortedReservations.length}</span> 件中{" "}
                  <span className="font-medium">{indexOfFirstItem + 1}</span> から{" "}
                  <span className="font-medium">
                    {Math.min(indexOfLastItem, sortedReservations.length)}
                  </span> 件を表示
                </div>
                <div className="flex items-center">
                  <label htmlFor="itemsPerPage" className="mr-2 text-sm text-gray-700 font-zen-kaku-gothic">
                    表示件数:
                  </label>
                  <select
                    id="itemsPerPage"
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                    className="border border-gray-300 rounded-md text-sm px-2 py-1"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
              
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                    >
                      予約ID
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                    >
                      ユーザー
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                    >
                      予約日時
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                    >
                      部屋タイプ
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                    >
                      金額
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                    >
                      ステータス
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                    >
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentReservations.map((reservation) => {
                    // 予約作成日時フォーマット
                    const createdDate =
                      toDate(reservation.createdAt) || new Date();
                    const formattedCreatedDate = format(
                      createdDate,
                      "yyyy/MM/dd HH:mm",
                      { locale: ja }
                    );

                    // 日付と時間の表示 - 新しいフィールドを優先
                    const displayDate =
                      reservation.displayDate ||
                      reservation.reservationDate ||
                      "";
                    const displayTime =
                      reservation.displayTimeRange ||
                      reservation.reservationTime ||
                      "";

                    return (
                      <tr key={reservation.id}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium font-zen-kaku-gothic">
                          <div className="flex flex-col">
                            <span className="truncate max-w-[150px]">
                              {reservation.id}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formattedCreatedDate}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-zen-kaku-gothic">
                          <div className="flex flex-col">
                            <span className="truncate max-w-[150px]">
                              {reservation.userEmail}
                            </span>
                            <span className="text-xs text-gray-500">
                              {reservation.userId?.slice(0, 8)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-zen-kaku-gothic">
                          <div className="flex flex-col">
                            <span>{displayDate}</span>
                            <span>{displayTime}</span>
                            {reservation.slowRoomAsSetPlan && (
                              <span className="text-xs text-gray-500">
                                スロールーム:{" "}
                                {reservation.displaySlowRoomTimeRange}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-zen-kaku-gothic">
                          {roomTypeNames[reservation.roomType] ||
                            reservation.roomType}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-zen-kaku-gothic">
                          ¥
                          {parseInt(String(reservation.price)).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-zen-kaku-gothic">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
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
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="space-x-2">
                            <button
                              onClick={() =>
                                router.push(
                                  `/admin/reservations/${reservation.id}`
                                )
                              }
                              className="text-indigo-600 hover:text-indigo-900 font-zen-kaku-gothic"
                            >
                              詳細
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => paginate(Math.max(1, currentPage - 1))}
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
                      onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
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
                      <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                        <span className="font-medium">{currentPage}</span> / <span className="font-medium">{totalPages}</span> ページ
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="ページネーション">
                        <button
                          onClick={() => paginate(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                            currentPage === 1
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <span className="sr-only">前へ</span>
                          &laquo;
                        </button>
                        
                        {/* 页码按钮 - 显示逻辑优化 */}
                        {Array.from({ length: Math.min(5, totalPages) }).map((_, index) => {
                          let pageNum;
                          // 如果总页数少于5，显示所有页码
                          if (totalPages <= 5) {
                            pageNum = index + 1;
                          }
                          // 如果当前页在开头，显示1-5
                          else if (currentPage <= 3) {
                            pageNum = index + 1;
                          }
                          // 如果当前页在末尾，显示末尾5页
                          else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + index;
                          }
                          // 其他情况，显示当前页及其前后2页
                          else {
                            pageNum = currentPage - 2 + index;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => paginate(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === pageNum
                                  ? "z-10 bg-indigo-50 border-indigo-500 text-indigo-600"
                                  : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                            currentPage === totalPages
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-500 hover:bg-gray-50"
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
      </AdminLayout>
    </Layout>
  );
}
