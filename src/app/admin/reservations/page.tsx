"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import { Reservation } from "@/types/reservation";
import { 
  formatTimestamp, 
  getTimestampMillis, 
  htmlToJapaneseDate,
  japaneseToHtmlDate,
  isReservationDateMatch
} from "@/utils/date";

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
  const [itemsPerPage, setItemsPerPage] = useState(10); // 恢复默认每页显示10条
  
  // 新增搜索相关状态
  const [isSearching, setIsSearching] = useState(false);
  
  // 表单状态
  const [formValues, setFormValues] = useState({
    searchTerm: "",
    statusFilter: "all",
    dateFilter: "",
    roomTypeFilter: "all"
  });
  
  // 日期格式转换状态
  const [dateInputValue, setDateInputValue] = useState("");
  
  // 处理日期变更
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value; // yyyy-mm-dd 格式
    setDateInputValue(dateValue);
    
    // 更新表单值为日语格式
    if (dateValue) {
      // 使用新的直接转换函数
      const formattedDate = htmlToJapaneseDate(dateValue);
      setFormValues({...formValues, dateFilter: formattedDate});
    } else {
      setFormValues({...formValues, dateFilter: ''});
    }
  };
  
  // 组件初始化和表单重置时同步日期控件
  useEffect(() => {
    // 当表单被重置或初始化，将日期输入控件的值设为空
    if (!formValues.dateFilter) {
      setDateInputValue("");
    } 
    // 当dateFilter有值，但dateInputValue为空时，尝试转换
    else if (formValues.dateFilter && !dateInputValue) {
      // 使用新的直接转换函数
      const htmlDateValue = japaneseToHtmlDate(formValues.dateFilter);
      setDateInputValue(htmlDateValue);
    }
  }, [formValues.dateFilter, dateInputValue]);

  // 部屋タイプのマッピング
  const roomTypeNames: Record<string, string> = {
    tototo: "TOTOTO",
    fuuu: "FUUU",
    zabuun: "ZABUUN",
    toron: "TORON",
    sauna_suite: "サウナスイート",
    slow_room: "スロールーム",
  };
  
  // 处理表单搜索
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 更新过滤器状态
    setSearchTerm(formValues.searchTerm);
    setStatusFilter(formValues.statusFilter);
    setDateFilter(formValues.dateFilter);
    setRoomTypeFilter(formValues.roomTypeFilter);
    
    // 执行搜索 - 重置所有分页状态
    setCurrentPage(1);
    executeSearch(true);
  };
  
  // 执行搜索
  const executeSearch = useCallback(async (resetSearch = false) => {
    if (!user || !adminState.isAdmin) return;
    
    // 根据是否重置搜索设置状态
    if (resetSearch) {
      setIsSearching(true);
      setIsLoading(true);
    }
    
    try {
      const token = await user.getIdToken();
      let apiUrl = "/api/admin/reservations";
      
      // 添加查询参数
      const params = new URLSearchParams();
      
      // 基本limit参数 - 一次获取较多数据，在前端进行分页
      params.append("limit", "1000");

      apiUrl += "?" + params.toString();
      
      console.log("搜索API URL:", apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error("検索中にエラーが発生しました");
      }
      
      const data = await response.json();
      console.log(`搜索结果: 共${data.reservations.length}条预约数据`);
      
      setReservations(data.reservations);
      setErrorMessage(null);
    } catch (error) {
      console.error("搜索错误:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "データの検索中にエラーが発生しました"
      );
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [
    user, 
    adminState.isAdmin
  ]);
  
  // 处理表单输入变化
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 重置表单
  const resetForm = () => {
    // 重置表单值
    setFormValues({
      searchTerm: "",
      statusFilter: "all",
      dateFilter: "",
      roomTypeFilter: "all"
    });
    
    // 重置日期输入控件
    setDateInputValue("");
    
    // 重置状态并执行搜索
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter("");
    setRoomTypeFilter("all");
    
    // 延迟执行搜索，确保状态已更新
    setTimeout(() => {
      executeSearch(true);
    }, 0);
  };

  // 刷新按钮
  const handleRefresh = () => {
    // 保持当前过滤器设置，但重新获取数据
    setSearchTerm(formValues.searchTerm);
    setStatusFilter(formValues.statusFilter);
    setDateFilter(formValues.dateFilter);
    setRoomTypeFilter(formValues.roomTypeFilter);
    
    executeSearch();
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

  // 予約データを取得 - 初次加载
  useEffect(() => {
    if (!user || !adminState.isAdmin || !adminState.checkComplete) return;
    
    // 初次加载数据
    executeSearch(true);
  }, [user, adminState, executeSearch]);

  // フィルター処理済みの予約リスト - 在前端进行更精细的筛选
  const filteredReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      // 1. 搜索词过滤（ID或邮箱）
      if (searchTerm) {
        if (searchTerm.includes("@")) {
          // 邮箱搜索
          if (!reservation.userEmail || !reservation.userEmail.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
          }
        } else {
          // ID搜索
          if (!reservation.id.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
          }
        }
      }
      
      // 2. 状态过滤
      if (statusFilter !== "all" && reservation.paymentStatus !== statusFilter) {
        return false;
      }
      
      // 3. 房间类型过滤
      if (roomTypeFilter !== "all" && reservation.roomType !== roomTypeFilter) {
        return false;
      }
      
      // 4. 日期过滤
      if (dateFilter) {
        // 尝试使用isReservationDateMatch工具函数检查日期是否匹配
        const searchDate = dateInputValue ? new Date(dateInputValue) : null;
        if (searchDate && !isReservationDateMatch(reservation, searchDate)) {
          return false;
        }
      }
      
      // 通过所有过滤条件
      return true;
    });
  }, [reservations, searchTerm, statusFilter, roomTypeFilter, dateFilter, dateInputValue]);

  // 日付でソート（新しい順）
  const sortedReservations = useMemo(() => {
    return [...filteredReservations].sort((a, b) => {
      // 共通関数を使用して日時のタイムスタンプを取得
      const timestampA = getTimestampMillis(a.createdAt);
      const timestampB = getTimestampMillis(b.createdAt);
      
      return timestampB - timestampA;
    });
  }, [filteredReservations]);
  
  // 显示记录总数
  const totalLoaded = sortedReservations.length;

  // 计算总页数
  const totalPages = Math.ceil(sortedReservations.length / itemsPerPage);
  
  // 计算当前页应显示的数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedReservations.slice(startIndex, endIndex);
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
            <form onSubmit={handleSearchSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label
                    htmlFor="searchTerm"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    検索
                  </label>
                  <input
                    type="text"
                    id="searchTerm"
                    name="searchTerm"
                    value={formValues.searchTerm}
                    onChange={handleFormChange}
                    placeholder="メールアドレス・予約ID"
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
                    name="statusFilter"
                    value={formValues.statusFilter}
                    onChange={handleFormChange}
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
                  <div className="flex space-x-2">
                    <input
                      type="date"
                      id="dateFilter"
                      name="dateFilter"
                      value={dateInputValue}
                      onChange={handleDateChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                    />
                  </div>
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
                    name="roomTypeFilter"
                    value={formValues.roomTypeFilter}
                    onChange={handleFormChange}
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

              <div className="flex justify-start space-x-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-800 text-white hover:bg-gray-700 rounded-md text-sm font-zen-kaku-gothic flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  検索
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 rounded-md text-sm font-zen-kaku-gothic"
                >
                  リセット
                </button>
              </div>
            </form>
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
                  全 <span className="font-medium">{totalLoaded}</span> 件中 
                  <span className="font-medium">
                    {totalLoaded === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                  </span> - 
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, totalLoaded)}
                  </span> 件を表示
                </div>
                <div className="flex items-center">
                  <label htmlFor="itemsPerPage" className="mr-2 text-sm text-gray-700 font-zen-kaku-gothic">
                    表示件数:
                  </label>
                  <select
                    id="itemsPerPage"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1); // 重置到第一页
                    }}
                    className="border border-gray-300 rounded-md text-sm px-2 py-1"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
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
                  {getCurrentPageData().map((reservation) => {
                    // 予約作成日時フォーマット - 共通関数を使用
                    const formattedCreatedDate = formatTimestamp(
                      reservation.createdAt, 
                      "yyyy/MM/dd HH:mm"
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
                              {reservation.userFullName || "未設定"}
                            </span>
                            <span className="text-xs text-gray-500 truncate max-w-[150px]">
                              {reservation.userEmail}
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
              {(reservations.length > 0) && (
                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                      disabled={currentPage === 1 || isLoading}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                        currentPage === 1 || isLoading
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      前へ
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                      disabled={currentPage === totalPages || isLoading}
                      className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                        currentPage === totalPages || isLoading
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
                        <span className="font-medium">{currentPage}</span> / <span className="font-medium">{Math.max(currentPage, totalPages)}</span> ページ
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="ページネーション">
                        <button
                          onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                          disabled={currentPage === 1 || isLoading}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                            currentPage === 1 || isLoading
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <span className="sr-only">前へ</span>
                          &laquo;
                        </button>
                        
                        {/* 页码按钮 - 显示逻辑优化 */}
                        {Array.from({ length: Math.min(5, Math.max(currentPage, totalPages)) }).map((_, index) => {
                          let pageNum;
                          const maxPage = Math.max(currentPage, totalPages);
                          
                          // 如果总页数少于5，显示所有页码
                          if (maxPage <= 5) {
                            pageNum = index + 1;
                          }
                          // 如果当前页在开头，显示1-5
                          else if (currentPage <= 3) {
                            pageNum = index + 1;
                          }
                          // 如果当前页在末尾，显示末尾5页
                          else if (currentPage >= maxPage - 2) {
                            pageNum = maxPage - 4 + index;
                          }
                          // 其他情况，显示当前页及其前后2页
                          else {
                            pageNum = currentPage - 2 + index;
                          }
                          
                          // 不显示超过实际可用页数的页码
                          if (pageNum > maxPage) return null;
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              disabled={isLoading}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === pageNum
                                  ? "z-10 bg-indigo-50 border-indigo-500 text-indigo-600"
                                  : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                              } ${isLoading ? "cursor-not-allowed" : ""}`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                          disabled={currentPage === totalPages || isLoading}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                            currentPage === totalPages || isLoading
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
              
              {reservations.length === 0 && !isLoading && (
                <div className="mt-6 text-center text-sm text-gray-500 font-zen-kaku-gothic">
                  予約データがありません
                </div>
              )}
            </div>
          )}
        </div>
      </AdminLayout>
    </Layout>
  );
}
