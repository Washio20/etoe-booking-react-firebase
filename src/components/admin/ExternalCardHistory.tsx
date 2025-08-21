"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Image from "next/image";
import { formatTimestamp } from "@/utils/date";

// 外部预约记录接口
interface ExternalReservation {
  id: string;
  userName: string;
  userEmail: string;
  physicalRoomId: string;
  startAt: any; // Firestore Timestamp
  endAt: any; // Firestore Timestamp
  cardNumber: string;
  cardEmailSent?: boolean;
  cardEmailSentAt?: any; // Firestore Timestamp
  cardEmailLanguage?: 'ja' | 'en'; // 添加邮件语言字段
  createdAt: any; // Firestore Timestamp
  createdBy: string;
  barcode?: string;
  status: string;
  isCancelled?: boolean; // 取消状态
  cancelledAt?: any; // 取消时间
  cancelledBy?: string; // 取消操作者
  cancelReason?: string; // 取消理由
}

export default function ExternalCardHistory() {
  const [user] = useAuthState(auth);
  const [reservations, setReservations] = useState<ExternalReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isResending, setIsResending] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 获取外部预约历史
  const fetchExternalReservations = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/external-reservations", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "データの取得に失敗しました");
      }

      const data = await response.json();
      setReservations(data.reservations || []);
    } catch (error) {
      console.error("Error fetching external reservations:", error);
      setError(
        error instanceof Error ? error.message : "データの取得中にエラーが発生しました"
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 重新发送邮件
  const resendEmail = async (reservationId: string, userEmail: string, userName: string, language: 'ja' | 'en') => {
    if (!user || isResending) return;

    try {
      setIsResending(`${reservationId}_${language}`);
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/send-external-card-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          reservationId,
          userEmail,
          userName,
          language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "メール送信に失敗しました");
      }

      // 重新获取数据
      await fetchExternalReservations();
      alert(language === 'en' ? "英語でメールを再送信しました" : "日本語でメールを再送信しました");
    } catch (error) {
      console.error("Error resending email:", error);
      alert(
        error instanceof Error ? error.message : "メール送信中にエラーが発生しました"
      );
    } finally {
      setIsResending(null);
    }
  };

  // 取消外部预约卡片
  const cancelCard = async (reservationId: string) => {
    if (!user || isCancelling) return;

    try {
      setIsCancelling(reservationId);
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/cancel-external-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          reservationId,
          cancelReason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "カードキャンセルに失敗しました");
      }

      // 重新获取数据
      await fetchExternalReservations();
      setShowCancelDialog(null);
      setCancelReason('');
      alert("カードが正常にキャンセルされました");
    } catch (error) {
      console.error("Error cancelling card:", error);
      alert(
        error instanceof Error ? error.message : "カードキャンセル中にエラーが発生しました"
      );
    } finally {
      setIsCancelling(null);
    }
  };

  // 格式化日期时间 - 使用统一的日期工具函数
  const formatDateTime = (timestamp: any) => {
    return formatTimestamp(timestamp, "yyyy/MM/dd HH:mm", "未設定");
  };

  // 获取房间类型显示
  const getRoomTypeDisplay = (physicalRoomId: string) => {
    const roomNumber = physicalRoomId.replace("room_", "");
    const firstDigit = roomNumber.charAt(0);

    if (firstDigit === "1") {
      if (roomNumber === "101") return "TOTOTO";
      if (roomNumber === "102") return "FUUU";
      if (roomNumber === "103") return "ZABUUN";
      if (roomNumber === "104") return "TORON";
    } else if (firstDigit === "2") {
      if (roomNumber === "201") return "サウナスイート";
      return "スロールーム";
    } else if (firstDigit === "3") {
      return "スロールーム";
    }

    return "未知";
  };

  // 计算总页数
  const totalPages = Math.ceil(reservations.length / itemsPerPage);
  
  // 计算当前页应显示的数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return reservations.slice(startIndex, endIndex);
  };

  useEffect(() => {
    fetchExternalReservations();
  }, [fetchExternalReservations]);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
          外部予約カード発送履歴
        </h2>
        <div className="flex justify-center py-8">
          <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
          外部予約カード発送履歴
        </h2>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-600 font-zen-kaku-gothic">{error}</p>
          <button
            onClick={fetchExternalReservations}
            className="mt-2 text-blue-600 underline text-sm font-zen-kaku-gothic"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {reservations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 font-zen-kaku-gothic">
            外部予約の履歴がありません
          </p>
        </div>
      ) : (
        <>
          {/* 分页信息 */}
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-700 font-zen-kaku-gothic">
              全 <span className="font-medium">{reservations.length}</span> 件中 
              <span className="font-medium">
                {reservations.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
              </span> - 
              <span className="font-medium">
                {Math.min(currentPage * itemsPerPage, reservations.length)}
              </span> 件を表示
            </div>
            <div className="flex items-center">
              <label htmlFor="itemsPerPageExternal" className="mr-2 text-sm text-gray-700 font-zen-kaku-gothic">
                表示件数:
              </label>
              <select
                id="itemsPerPageExternal"
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

          <div className="space-y-4 overflow-y-auto">
            {getCurrentPageData().map((reservation) => (
            <div
              key={reservation.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                {/* 主要信息区域 */}
                <div className="flex-1 space-y-3">
                  {/* 标题行 */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <h3 className="font-medium text-gray-800 font-zen-kaku-gothic">
                      {reservation.userName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-gray-500 font-zen-kaku-gothic">
                        部屋: {reservation.physicalRoomId.replace("room_", "")} (
                        {getRoomTypeDisplay(reservation.physicalRoomId)})
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium font-zen-kaku-gothic ${
                          reservation.isCancelled
                            ? "bg-red-100 text-red-800"
                            : !reservation.cardEmailSent
                            ? "bg-yellow-100 text-yellow-800"
                            : reservation.cardEmailLanguage === 'en'
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {reservation.isCancelled
                          ? "キャンセル済み"
                          : reservation.cardEmailSent 
                          ? reservation.cardEmailLanguage === 'en' 
                            ? "英語送信済み" 
                            : "日本語送信済み"
                          : "未送信"}
                      </span>
                    </div>
                  </div>

                  {/* 详细信息 */}
                  <div className="space-y-2 text-sm text-gray-600 font-zen-kaku-gothic">
                    <p className="break-words">
                      <span className="font-medium">メール:</span> {reservation.userEmail}
                    </p>
                    <p className="break-all">
                      <span className="font-medium">カード番号:</span> {reservation.cardNumber}
                    </p>
                    <p className="break-words">
                      <span className="font-medium">利用期間:</span> {formatDateTime(reservation.startAt)} ～ {formatDateTime(reservation.endAt)}
                    </p>
                    {reservation.cardEmailSent && reservation.cardEmailSentAt && (
                      <p className="break-words">
                        <span className="font-medium">送信日時:</span> {formatDateTime(reservation.cardEmailSentAt)}
                      </p>
                    )}
                    {reservation.isCancelled && reservation.cancelledAt && (
                      <p className="break-words text-red-600">
                        <span className="font-medium">キャンセル日時:</span> {formatDateTime(reservation.cancelledAt)}
                      </p>
                    )}
                    {reservation.isCancelled && reservation.cancelReason && (
                      <p className="break-words text-red-600">
                        <span className="font-medium">キャンセル理由:</span> {reservation.cancelReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* 操作按钮区域 */}
                <div className="flex flex-row lg:flex-col gap-2 lg:shrink-0">
                  {/* 查看条形码按钮 */}
                  <button
                    onClick={() =>
                      setExpandedCard(
                        expandedCard === reservation.id ? null : reservation.id
                      )
                    }
                    className="flex-1 lg:flex-none px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm font-zen-kaku-gothic hover:bg-gray-200 transition-colors whitespace-nowrap"
                  >
                    {expandedCard === reservation.id ? "非表示" : "バーコード表示"}
                  </button>

                  {!reservation.isCancelled && (
                    <>
                      {/* 重新发送邮件按钮 - 日本語 */}
                      <button
                        onClick={() =>
                          resendEmail(
                            reservation.id,
                            reservation.userEmail,
                            reservation.userName,
                            'ja'
                          )
                        }
                        disabled={isResending === `${reservation.id}_ja` || isResending === `${reservation.id}_en`}
                        className={`flex-1 lg:flex-none px-3 py-1 rounded text-sm font-zen-kaku-gothic transition-colors whitespace-nowrap ${
                          isResending === `${reservation.id}_ja` || isResending === `${reservation.id}_en`
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        }`}
                      >
                        {isResending === `${reservation.id}_ja` ? "送信中..." : "日本語で再送信"}
                      </button>
                      
                      {/* 重新发送邮件按钮 - English */}
                      <button
                        onClick={() =>
                          resendEmail(
                            reservation.id,
                            reservation.userEmail,
                            reservation.userName,
                            'en'
                          )
                        }
                        disabled={isResending === `${reservation.id}_ja` || isResending === `${reservation.id}_en`}
                        className={`flex-1 lg:flex-none px-3 py-1 rounded text-sm font-zen-kaku-gothic transition-colors whitespace-nowrap ${
                          isResending === `${reservation.id}_en` || isResending === `${reservation.id}_ja`
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-green-100 text-green-800 hover:bg-green-200"
                        }`}
                      >
                        {isResending === `${reservation.id}_en` ? "送信中..." : "英語で再送信"}
                      </button>

                      {/* 取消按钮 */}
                      <button
                        onClick={() => setShowCancelDialog(reservation.id)}
                        disabled={isCancelling === reservation.id}
                        className={`flex-1 lg:flex-none px-3 py-1 rounded text-sm font-zen-kaku-gothic transition-colors whitespace-nowrap ${
                          isCancelling === reservation.id
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-red-100 text-red-800 hover:bg-red-200"
                        }`}
                      >
                        {isCancelling === reservation.id ? "処理中..." : "キャンセル"}
                      </button>
                    </>
                  )}

                </div>
              </div>

              {/* 展开的条形码显示 */}
              {expandedCard === reservation.id && reservation.barcode && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-center bg-white p-4 rounded border">
                    {reservation.barcode.startsWith("data:image") ? (
                      <Image
                        src={reservation.barcode}
                        alt="Barcode"
                        width={400}
                        height={120}
                        className="max-w-full h-auto"
                        unoptimized={true}
                      />
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{ __html: reservation.barcode }}
                        className="max-w-full overflow-auto"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2 font-zen-kaku-gothic">
                    カード番号: {reservation.cardNumber}
                  </p>
                </div>
              )}
            </div>
          ))}
          </div>

          {/* 分页控件 */}
          {reservations.length > 0 && (
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
                    
                    {/* 页码按钮 */}
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
        </>
      )}

      {/* 取消确认对话框 */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 font-zen-kaku-gothic">
                カードキャンセル確認
              </h3>
              <p className="text-sm text-gray-600 mb-4 font-zen-kaku-gothic">
                このカードをキャンセルします。一度キャンセルされたカードは無効になり、お客様は入室できなくなります。
              </p>
              <div className="mb-4">
                <label htmlFor="cancelReason" className="block text-sm font-medium text-gray-700 mb-2 font-zen-kaku-gothic">
                  キャンセル理由（任意）
                </label>
                <textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-zen-kaku-gothic"
                  rows={3}
                  placeholder="例：部屋番号間違い、満室のため..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCancelDialog(null);
                    setCancelReason('');
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 font-zen-kaku-gothic"
                >
                  戻る
                </button>
                <button
                  onClick={() => cancelCard(showCancelDialog)}
                  disabled={isCancelling === showCancelDialog}
                  className={`px-4 py-2 rounded-md font-zen-kaku-gothic ${
                    isCancelling === showCancelDialog
                      ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {isCancelling === showCancelDialog ? "処理中..." : "キャンセル実行"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}