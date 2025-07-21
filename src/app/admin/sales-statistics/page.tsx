'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/utils/firebase';
import Layout from '@/components/Layout';
import AdminLayout from '@/components/AdminLayout';
import * as XLSX from 'xlsx';

interface DailySales {
  date: string;
  totalAmount: number;
  count: number;
}

interface MonthlySales {
  month: string;
  totalAmount: number;
  count: number;
}

interface RoomTypeSales {
  roomType: string;
  totalAmount: number;
  count: number;
}

interface RepeaterStats {
  overview: {
    totalUsers: number;
    firstTimeUsers: number;
    repeatUsers: number;
    repeaterRate: number;
  };
  genderStats: {
    male: { total: number; repeaters: number };
    female: { total: number; repeaters: number };
    unknown: { total: number; repeaters: number };
  };
  ageGroupStats: {
    [key: string]: { total: number; repeaters: number };
  };
  visitCountDistribution: {
    [key: string]: number;
  };
  userDetails: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    gender?: string;
    age?: number;
    firstVisitDate: string;
    lastVisitDate: string;
    totalVisits: number;
    totalAmount: number;
    roomTypes: string;
  }>;
}

interface DetailedDailySales {
  date: string;
  totalAmount: number;
  privateSaunaAmount: number;
  totalCount: number;
  saunaTotalCount: number; // 只计算sauna房间的总件数
  dayUseAmount: number;
  dayUseCount: number;
  dayUseOnly: number;
  roomTypeCounts: {
    tototo: number;
    fuuu: number;
    zabuun: number;
    toron: number;
    sauna_suite: number;
  };
}

export default function SalesStatisticsPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [isLoading, setIsLoading] = useState(true);
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'roomType' | 'repeater'>('daily');
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthlySales[]>([]);
  const [roomTypeSales, setRoomTypeSales] = useState<RoomTypeSales[]>([]);
  const [detailedDailySales, setDetailedDailySales] = useState<DetailedDailySales[]>([]);
  const [repeaterStats, setRepeaterStats] = useState<RepeaterStats | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const fetchSalesData = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/sales-statistics?start=${dateRange.start}&end=${dateRange.end}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sales data');
      }

      const data = await response.json();
      setDailySales(data.dailySales);
      setMonthlySales(data.monthlySales);
      setRoomTypeSales(data.roomTypeSales);
      setDetailedDailySales(data.detailedDailySales || []);
      setRepeaterStats(data.repeaterStats || null);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

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
          // 获取销售数据
          fetchSalesData(token);
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
  }, [user, loading, fetchSalesData]);

  // 当日期范围变更时重新获取数据
  useEffect(() => {
    if (adminState.isAdmin && user) {
      user.getIdToken().then(token => fetchSalesData(token));
    }
  }, [dateRange, adminState.isAdmin, user, fetchSalesData]);

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };

  // 获取日语星期几
  const getJapaneseDayOfWeek = (dateStr: string) => {
    const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const date = new Date(dateStr.replace(/\//g, '-'));
    return days[date.getDay()];
  };

  // Excel下载功能
  const downloadExcel = () => {
    if (activeTab === 'repeater') {
      downloadRepeaterExcel();
      return;
    }
    
    if (detailedDailySales.length === 0) {
      alert('データがありません');
      return;
    }

    // 创建Excel数据
    const excelData = [
      [
        '日付', '曜日', '総売上', 'プライベートサウナ売上', 'tototo', 'fuuu', 'zabuun', 'toron', 
        'サウナスイート', '総件数', 'デイユース売上', '総件数', 'デイユース単体', 'セット割利用'
      ]
    ];

    detailedDailySales.forEach(dayData => {
      const dayOfWeek = getJapaneseDayOfWeek(dayData.date);
      excelData.push([
        dayData.date,
        dayOfWeek,
        `¥${dayData.totalAmount.toLocaleString()}`,
        `¥${dayData.privateSaunaAmount.toLocaleString()}`,
        dayData.roomTypeCounts.tototo > 0 ? dayData.roomTypeCounts.tototo.toString() : '',
        dayData.roomTypeCounts.fuuu > 0 ? dayData.roomTypeCounts.fuuu.toString() : '',
        dayData.roomTypeCounts.zabuun > 0 ? dayData.roomTypeCounts.zabuun.toString() : '',
        dayData.roomTypeCounts.toron > 0 ? dayData.roomTypeCounts.toron.toString() : '',
        dayData.roomTypeCounts.sauna_suite > 0 ? dayData.roomTypeCounts.sauna_suite.toString() : '',
        `${dayData.saunaTotalCount}件`,
        dayData.dayUseAmount > 0 ? `¥${dayData.dayUseAmount.toLocaleString()}` : '',
        `${dayData.dayUseCount}件`,
        dayData.dayUseOnly > 0 ? dayData.dayUseOnly.toString() : '',
        '' // セット割利用は空にする
      ]);
    });

    // 创建工作簿和工作表
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '売上統計');

    // 设置列宽
    const colWidths = [
      { wch: 12 }, // 日付
      { wch: 8 },  // 曜日
      { wch: 12 }, // 総売上
      { wch: 18 }, // プライベートサウナ売上
      { wch: 8 },  // tototo
      { wch: 8 },  // fuuu
      { wch: 8 },  // zabuun
      { wch: 8 },  // toron
      { wch: 12 }, // サウナスイート
      { wch: 8 },  // 総件数
      { wch: 14 }, // デイユース売上
      { wch: 8 },  // 総件数
      { wch: 12 }, // デイユース単体
      { wch: 12 }  // セット割利用
    ];
    ws['!cols'] = colWidths;

    // 下载文件
    const fileName = `売上統計_${dateRange.start.replace(/-/g, '')}_${dateRange.end.replace(/-/g, '')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // リピーター统计Excel下载功能
  const downloadRepeaterExcel = () => {
    if (!repeaterStats || repeaterStats.userDetails.length === 0) {
      alert('リピーターデータがありません');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 概要統計シート
    const overviewData = [
      ['リピーター統計概要'],
      [''],
      ['項目', '数値'],
      ['総ユーザー数', repeaterStats.overview.totalUsers],
      ['初回利用者数', repeaterStats.overview.firstTimeUsers],
      ['リピーター数', repeaterStats.overview.repeatUsers],
      ['リピーター率(%)', repeaterStats.overview.repeaterRate],
      [''],
      ['性別統計'],
      ['性別', '総数', 'リピーター数', 'リピーター率(%)'],
      ['男性', repeaterStats.genderStats.male.total, repeaterStats.genderStats.male.repeaters, 
       repeaterStats.genderStats.male.total > 0 ? Math.round(repeaterStats.genderStats.male.repeaters / repeaterStats.genderStats.male.total * 10000) / 100 : 0],
      ['女性', repeaterStats.genderStats.female.total, repeaterStats.genderStats.female.repeaters,
       repeaterStats.genderStats.female.total > 0 ? Math.round(repeaterStats.genderStats.female.repeaters / repeaterStats.genderStats.female.total * 10000) / 100 : 0],
      ['不明', repeaterStats.genderStats.unknown.total, repeaterStats.genderStats.unknown.repeaters,
       repeaterStats.genderStats.unknown.total > 0 ? Math.round(repeaterStats.genderStats.unknown.repeaters / repeaterStats.genderStats.unknown.total * 10000) / 100 : 0],
      [''],
      ['年代別統計'],
      ['年代', '総数', 'リピーター数', 'リピーター率(%)']
    ];

    Object.entries(repeaterStats.ageGroupStats).forEach(([ageGroup, stats]) => {
      const repeaterRate = stats.total > 0 ? Math.round(stats.repeaters / stats.total * 10000) / 100 : 0;
      overviewData.push([ageGroup, stats.total, stats.repeaters, repeaterRate]);
    });

    overviewData.push(['']);
    overviewData.push(['利用回数分布']);
    overviewData.push(['利用回数', 'ユーザー数']);
    Object.entries(repeaterStats.visitCountDistribution).forEach(([visitCount, userCount]) => {
      overviewData.push([visitCount, userCount]);
    });

    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewSheet, '概要統計');

    // 詳細ユーザー一覧シート
    const userDetailsData = [
      ['ユーザー詳細一覧'],
      [''],
      ['ユーザーID', 'ユーザー名', 'メールアドレス', '性別', '年齢', '初回利用日', '最終利用日', '利用回数', '総利用金額', '利用部屋タイプ']
    ];

    repeaterStats.userDetails.forEach(user => {
      userDetailsData.push([
        user.userId,
        user.userName,
        user.userEmail,
        user.gender === 'male' ? '男性' : user.gender === 'female' ? '女性' : '不明',
        user.age?.toString() || '不明',
        user.firstVisitDate,
        user.lastVisitDate,
        user.totalVisits.toString(),
        `¥${user.totalAmount.toLocaleString()}`,
        user.roomTypes
      ]);
    });

    const userDetailsSheet = XLSX.utils.aoa_to_sheet(userDetailsData);
    XLSX.utils.book_append_sheet(wb, userDetailsSheet, 'ユーザー詳細');

    const fileName = `リピーター統計_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const renderDailySales = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              日付
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              売上金額
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              件数
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dailySales.map((sale) => (
            <tr key={sale.date}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {sale.date}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(sale.totalAmount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {sale.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderMonthlySales = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              月
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              売上金額
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              件数
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {monthlySales.map((sale) => (
            <tr key={sale.month}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {sale.month}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(sale.totalAmount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {sale.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderRoomTypeSales = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              部屋タイプ
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              売上金額
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              件数
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {roomTypeSales.map((sale) => (
            <tr key={sale.roomType}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {sale.roomType}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(sale.totalAmount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {sale.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderRepeaterStats = () => {
    if (!repeaterStats) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-600 font-zen-kaku-gothic">リピーターデータが読み込まれていません。</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* 概要統計 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-600 mb-2">総ユーザー数</h3>
            <p className="text-2xl font-bold text-blue-900">{repeaterStats.overview.totalUsers}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-600 mb-2">リピーター数</h3>
            <p className="text-2xl font-bold text-green-900">{repeaterStats.overview.repeatUsers}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-purple-600 mb-2">初回利用者数</h3>
            <p className="text-2xl font-bold text-purple-900">{repeaterStats.overview.firstTimeUsers}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-orange-600 mb-2">リピーター率</h3>
            <p className="text-2xl font-bold text-orange-900">{repeaterStats.overview.repeaterRate}%</p>
          </div>
        </div>

        {/* 性別統計 */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">性別統計</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">性別</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">総数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">リピーター数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">リピーター率</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">男性</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{repeaterStats.genderStats.male.total}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{repeaterStats.genderStats.male.repeaters}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {repeaterStats.genderStats.male.total > 0 ? 
                      Math.round(repeaterStats.genderStats.male.repeaters / repeaterStats.genderStats.male.total * 10000) / 100 : 0}%
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">女性</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{repeaterStats.genderStats.female.total}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{repeaterStats.genderStats.female.repeaters}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {repeaterStats.genderStats.female.total > 0 ? 
                      Math.round(repeaterStats.genderStats.female.repeaters / repeaterStats.genderStats.female.total * 10000) / 100 : 0}%
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">不明</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{repeaterStats.genderStats.unknown.total}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{repeaterStats.genderStats.unknown.repeaters}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {repeaterStats.genderStats.unknown.total > 0 ? 
                      Math.round(repeaterStats.genderStats.unknown.repeaters / repeaterStats.genderStats.unknown.total * 10000) / 100 : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 年代別統計 */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">年代別統計</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">年代</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">総数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">リピーター数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">リピーター率</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(repeaterStats.ageGroupStats).map(([ageGroup, stats]) => (
                  <tr key={ageGroup}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ageGroup}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.total}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.repeaters}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stats.total > 0 ? Math.round(stats.repeaters / stats.total * 10000) / 100 : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 利用回数分布 */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">利用回数分布</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">利用回数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ユーザー数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">割合</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(repeaterStats.visitCountDistribution).map(([visitCount, userCount]) => (
                  <tr key={visitCount}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{visitCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{userCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {repeaterStats.overview.totalUsers > 0 ? 
                        Math.round(userCount / repeaterStats.overview.totalUsers * 10000) / 100 : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 詳細ユーザー一覧（上位20名） */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">詳細ユーザー一覧 (利用回数上位20名)</h3>
            <p className="text-sm text-gray-500 mt-1">Excel ダウンロードで全ユーザーの詳細データを取得できます。</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ユーザー名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">性別</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">年齢</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">利用回数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">総利用金額</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">初回利用日</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最終利用日</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {repeaterStats.userDetails.slice(0, 20).map((user) => (
                  <tr key={user.userId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.userName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.gender === 'male' ? '男性' : user.gender === 'female' ? '女性' : '不明'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.age || '不明'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.totalVisits}回</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">¥{user.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.firstVisitDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.lastVisitDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
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
            onClick={() => router.push("/login?returnTo=/admin/sales-statistics")}
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
              売上統計
            </h1>
            <button
              onClick={downloadExcel}
              disabled={isLoading || (activeTab === 'repeater' ? !repeaterStats : detailedDailySales.length === 0)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-zen-kaku-gothic rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel ダウンロード
            </button>
          </div>

        <div className="mb-6 flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('daily')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'daily'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                日別売上
              </button>
              <button
                onClick={() => setActiveTab('monthly')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'monthly'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                月別売上
              </button>
              <button
                onClick={() => setActiveTab('roomType')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'roomType'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                部屋別売上
              </button>
              <button
                onClick={() => setActiveTab('repeater')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'repeater'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                リピーター統計
              </button>
            </nav>
          </div>
        </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
            </div>
          ) : (
            <>
              {activeTab === 'daily' && renderDailySales()}
              {activeTab === 'monthly' && renderMonthlySales()}
              {activeTab === 'roomType' && renderRoomTypeSales()}
              {activeTab === 'repeater' && renderRepeaterStats()}
            </>
          )}
        </div>
      </AdminLayout>
    </Layout>
  );
}