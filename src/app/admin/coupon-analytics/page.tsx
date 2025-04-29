"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import { auth } from "@/utils/firebase";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

// 图表颜色
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// 接口定义
interface AnalyticsData {
  totalCoupons: number;
  activeCoupons: number;
  usedCoupons: number;
  totalDiscount: number;
  couponsByType: { name: string; value: number }[];
  topCoupons: { code: string; name: string; usedCount: number; totalDiscount: number }[];
  usageByMonth: { month: string; count: number }[];
}

// 图表组件类型定义
interface ChartComponentProps {
  name: string;
  percent: number;
}

export default function CouponAnalytics() {
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  // 修改初始状态，加入额外的管理权限检查完成指示
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalCoupons: 0,
    activeCoupons: 0,
    usedCoupons: 0,
    totalDiscount: 0,
    couponsByType: [],
    topCoupons: [],
    usageByMonth: []
  });
  
  // 检查管理员权限
  useEffect(() => {
    // 如果还在加载用户状态，不执行检查
    if (loading) return;

    const checkAdminStatus = async () => {
      // 未登录
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
  
  // 加载优惠券统计数据
  useEffect(() => {
    if (!user || !adminState.isAdmin) return;

    const loadAnalytics = async () => {
      try {
        setIsLoading(true);
        
        const idToken = await user.getIdToken();
        const response = await fetch("/api/admin/coupon-analytics", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        }
      } catch (error) {
        console.error("Error loading coupon analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (adminState.isAdmin) {
      loadAnalytics();
    }
  }, [user, adminState.isAdmin]);
  
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
            onClick={() => router.push("/login?returnTo=/admin/coupon-analytics")}
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
  
  if (isLoading) {
    return (
      <Layout>
        <AdminLayout>
          <div className="p-4">
            <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
          </div>
        </AdminLayout>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <AdminLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-300 pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
              <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wider font-zen-kaku-gothic">
                クーポン分析
              </h1>
              <button
                onClick={() => router.push("/admin/coupons")}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-300 transition-colors flex items-center"
              >
                一覧に戻る
              </button>
            </div>
          </div>
          
          {/* 概要カード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded shadow-sm border border-gray-100">
              <h2 className="text-sm text-gray-500 font-zen-kaku-gothic">総クーポン数</h2>
              <p className="text-2xl font-bold">{analytics.totalCoupons}</p>
            </div>
            
            <div className="bg-white p-4 rounded shadow-sm border border-gray-100">
              <h2 className="text-sm text-gray-500 font-zen-kaku-gothic">有効クーポン数</h2>
              <p className="text-2xl font-bold">{analytics.activeCoupons}</p>
            </div>
            
            <div className="bg-white p-4 rounded shadow-sm border border-gray-100">
              <h2 className="text-sm text-gray-500 font-zen-kaku-gothic">使用済みクーポン数</h2>
              <p className="text-2xl font-bold">{analytics.usedCoupons}</p>
            </div>
            
            <div className="bg-white p-4 rounded shadow-sm border border-gray-100">
              <h2 className="text-sm text-gray-500 font-zen-kaku-gothic">総割引額</h2>
              <p className="text-2xl font-bold">{analytics.totalDiscount.toLocaleString()}円</p>
            </div>
          </div>
          
          {/* グラフ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* クーポンタイプ分布 */}
            <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
              <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">クーポンタイプ分布</h2>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.couponsByType}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, percent}: ChartComponentProps) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {analytics.couponsByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* 月別使用数 */}
            <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
              <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">月別使用数</h2>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.usageByMonth}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8884d8" name="使用数" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* 人気クーポン */}
          <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
            <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">人気クーポン TOP 10</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap font-zen-kaku-gothic">クーポンコード</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap font-zen-kaku-gothic">クーポン名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap font-zen-kaku-gothic">使用回数</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap font-zen-kaku-gothic">総割引額</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.topCoupons.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 font-zen-kaku-gothic">
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    analytics.topCoupons.map((coupon, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{coupon.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{coupon.name || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{coupon.usedCount}回</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{coupon.totalDiscount.toLocaleString()}円</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AdminLayout>
    </Layout>
  );
}