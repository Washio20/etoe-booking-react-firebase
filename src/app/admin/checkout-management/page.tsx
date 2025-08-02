'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/utils/firebase';
import Layout from '@/components/Layout';
import AdminLayout from '@/components/AdminLayout';
import { CheckoutRecord, CheckoutStatus } from '@/types/checkout';
import { formatTimestamp } from '@/utils/date';

interface ExtendedRoomStatusSummary {
  totalRooms: number;
  totalCheckouts: number;
  uniqueRoomsCount: number;
  checkedOutRooms: number;
  readyRooms: number;
}

export default function CheckoutManagementPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [isLoading, setIsLoading] = useState(true);
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });

  const [checkouts, setCheckouts] = useState<CheckoutRecord[]>([]);
  const [summary, setSummary] = useState<ExtendedRoomStatusSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  
  // 確認ダイアログの状態
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    checkoutId: string;
    newStatus: CheckoutStatus;
    roomId: string;
  } | null>(null);

  const fetchCheckoutData = useCallback(async (token: string, date: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/checkouts?date=${date}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch checkout data');
      }

      const data = await response.json();
      console.log('Received checkout data:', data.checkouts); // 调试用
      setCheckouts(data.checkouts || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error('Error fetching checkout data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 检查管理员权限
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (loading) return;
      
      if (!user) {
        setAdminState({ isAdmin: false, checkComplete: true });
        return;
      }

      try {
        const token = await user.getIdToken();
        const idTokenResult = await user.getIdTokenResult();
        
        if (idTokenResult.claims.admin) {
          setAdminState({ isAdmin: true, checkComplete: true });
          await fetchCheckoutData(token, selectedDate);
        } else {
          setAdminState({ isAdmin: false, checkComplete: true });
        }
      } catch (error) {
        console.error('管理员权限检查失败:', error);
        setAdminState({ isAdmin: false, checkComplete: true });
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, loading, selectedDate, fetchCheckoutData]);

  // 日期变更时重新获取数据
  useEffect(() => {
    if (adminState.isAdmin && user) {
      user.getIdToken().then(token => fetchCheckoutData(token, selectedDate));
    }
  }, [selectedDate, adminState.isAdmin, user, fetchCheckoutData]);

  const updateRoomStatus = (checkoutId: string, newStatus: CheckoutStatus, roomId: string) => {
    // 確認ダイアログを表示
    setConfirmAction({ checkoutId, newStatus, roomId });
    setShowConfirmDialog(true);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!user || !confirmAction) return;
    
    setShowConfirmDialog(false);
    setUpdatingStatus(confirmAction.checkoutId);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/checkouts', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkoutId: confirmAction.checkoutId,
          status: confirmAction.newStatus
        }),
      });

      if (response.ok) {
        // 重新获取数据
        await fetchCheckoutData(token, selectedDate);
      } else {
        alert('ステータスの更新に失敗しました');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('エラーが発生しました');
    } finally {
      setUpdatingStatus(null);
      setConfirmAction(null);
    }
  };

  const handleCancelStatusUpdate = () => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  const getStatusDisplayName = (status: CheckoutStatus): string => {
    switch (status) {
      case CheckoutStatus.CHECKED_OUT:
        return 'チェックアウト済み';
      case CheckoutStatus.CLEANED:
        return '清掃済み';
      case CheckoutStatus.READY:
        return '準備完了';
      default:
        return 'チェックアウト済み'; // デフォルトは日本語で表示
    }
  };

  const getStatusColor = (status: CheckoutStatus): string => {
    switch (status) {
      case CheckoutStatus.CHECKED_OUT:
        return 'bg-yellow-100 text-yellow-800';
      case CheckoutStatus.CLEANED:
        return 'bg-blue-100 text-blue-800';
      case CheckoutStatus.READY:
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-yellow-100 text-yellow-800'; // デフォルトはチェックアウト済みと同じ色
    }
  };

  const formatDateTime = (timestamp: any): string => {
    // 使用共通的日期格式化函数，确保正确处理时区
    console.log('Formatting timestamp:', timestamp); // 调试用
    
    if (!timestamp) {
      console.warn('Empty timestamp');
      return '-';
    }

    // 尝试多种格式的时间戳处理
    let dateToFormat = null;
    
    if (timestamp._seconds) {
      // Firestore Timestamp 格式
      dateToFormat = new Date(timestamp._seconds * 1000);
    } else if (timestamp.seconds) {
      // 另一种 Firestore Timestamp 格式
      dateToFormat = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string') {
      // ISO字符串格式
      dateToFormat = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      // Date对象
      dateToFormat = timestamp;
    } else if (typeof timestamp === 'number') {
      // Unix时间戳
      dateToFormat = new Date(timestamp);
    }

    if (!dateToFormat || isNaN(dateToFormat.getTime())) {
      console.warn('Could not parse timestamp:', timestamp);
      return '-';
    }

    try {
      const result = formatTimestamp(dateToFormat, "yyyy/MM/dd HH:mm", "-");
      console.log('Formatted result:', result); // 调试用
      return result;
    } catch (error) {
      console.error('Format error:', error);
      // 备用格式化方法
      return dateToFormat.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
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
            onClick={() => router.push("/login?returnTo=/admin/checkout-management")}
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
              チェックアウト管理
            </h1>
          </div>

          {/* 日付選択 */}
          <div className="flex items-center gap-4">
            <label className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic">
              対象日
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 統計情報 */}
          {summary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-purple-600 mb-2 font-zen-kaku-gothic">チェックアウト回数</h3>
                  <p className="text-2xl font-bold text-purple-900">{summary.totalCheckouts || summary.totalRooms}</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-indigo-600 mb-2 font-zen-kaku-gothic">対象部屋数</h3>
                  <p className="text-2xl font-bold text-indigo-900">{summary.uniqueRoomsCount || '-'}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-yellow-600 mb-2 font-zen-kaku-gothic">未清掃</h3>
                  <p className="text-2xl font-bold text-yellow-900">{summary.checkedOutRooms}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-green-600 mb-2 font-zen-kaku-gothic">準備完了</h3>
                  <p className="text-2xl font-bold text-green-900">{summary.readyRooms}</p>
                </div>
              </div>
            </>
          )}

          {/* チェックアウト一覧 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 font-zen-kaku-gothic">
                チェックアウト一覧
              </h2>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2 text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
              </div>
            ) : checkouts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 font-zen-kaku-gothic">
                  {selectedDate}にチェックアウトした部屋はありません
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic">
                        部屋番号
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic">
                        チェックアウト時間
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic">
                        ステータス
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic">
                        お客様備考
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {checkouts.map((checkout) => (
                      <tr key={checkout.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {checkout.roomId}号室
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDateTime(checkout.checkedOutAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full font-zen-kaku-gothic ${getStatusColor(checkout.status)}`}>
                            {getStatusDisplayName(checkout.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          <div className="whitespace-pre-wrap break-words">
                            {checkout.guestNote || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          {(checkout.status === CheckoutStatus.CHECKED_OUT || checkout.status === CheckoutStatus.CLEANED) && (
                            <button
                              onClick={() => updateRoomStatus(checkout.id, CheckoutStatus.READY, checkout.roomId)}
                              disabled={updatingStatus === checkout.id}
                              className="px-3 py-1 text-green-600 hover:text-green-900 border border-green-600 hover:border-green-900 rounded font-zen-kaku-gothic disabled:opacity-50 text-xs"
                              title="清掃・準備が完了したらクリックしてください"
                            >
                              {updatingStatus === checkout.id ? '更新中...' : '✅ 準備完了'}
                            </button>
                          )}
                          {checkout.status === CheckoutStatus.READY && (
                            <span className="text-gray-500 text-xs font-zen-kaku-gothic">完了済み</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        
        {/* 確認ダイアログ */}
        {showConfirmDialog && confirmAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm md:max-w-md mx-auto">
              <h3 className="text-lg font-bold text-gray-800 mb-4 font-zen-kaku-gothic">
                ステータス変更確認
              </h3>
              <div className="mb-6">
                <p className="text-gray-700 mb-2 font-zen-kaku-gothic">
                  <span className="font-medium">{confirmAction.roomId}号室</span>を
                  <span className="font-medium text-green-600">準備完了</span>
                  に変更してもよろしいですか？
                </p>
                <p className="text-sm text-red-600 font-zen-kaku-gothic">
                  ※この操作は取り消しできません。
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancelStatusUpdate}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded font-zen-kaku-gothic hover:bg-gray-400 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfirmStatusUpdate}
                  className="px-4 py-2 text-white rounded font-zen-kaku-gothic transition-colors bg-green-600 hover:bg-green-700"
                >
                  準備完了にする
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </Layout>
  );
}