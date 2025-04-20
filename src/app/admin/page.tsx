"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";

export default function AdminPage() {
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });

  // 检查用户是否有管理员权限
  useEffect(() => {
    if (loading) return;

    const checkAdminStatus = async () => {
      if (!user) {
        setAdminState({ isAdmin: false, checkComplete: true });
        return;
      }

      try {
        // 获取用户的ID令牌
        const idTokenResult = await user.getIdTokenResult(true);

        // 检查自定义声明
        const isUserAdmin = idTokenResult.claims.admin === true;
        setAdminState({ isAdmin: isUserAdmin, checkComplete: true });
      } catch (error) {
        console.error("管理员权限检查失败:", error);
        setAdminState({ isAdmin: false, checkComplete: true });
      }
    };

    checkAdminStatus();
  }, [user, loading]);

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

  // 未登录状态
  if (!user) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic mb-4">
            管理者ページにアクセスするには、ログインしてください。
          </p>
          <button
            onClick={() => router.push("/login?returnTo=/admin")}
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
          >
            ログイン
          </button>
        </div>
      </Layout>
    );
  }

  // 无管理员权限
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

  // 管理员页面
  return (
    <Layout>
      <AdminLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-300 pb-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wider font-zen-kaku-gothic">
              管理者ダッシュボード
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* お問い合わせ管理 */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 font-zen-kaku-gothic">
                  お問い合わせ管理
                </h2>
                <svg
                  className="h-8 w-8 text-gray-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"
                  />
                </svg>
              </div>
              <p className="mt-2 text-sm text-gray-600 font-zen-kaku-gothic">
                ユーザーからのお問い合わせを管理します。
              </p>
              <div className="mt-4">
                <button
                  onClick={() => router.push("/admin/contacts")}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-700 hover:bg-gray-800 font-zen-kaku-gothic"
                >
                  管理する
                </button>
              </div>
            </div>

            {/* 予約管理 */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 font-zen-kaku-gothic">
                  予約管理
                </h2>
                <svg
                  className="h-8 w-8 text-gray-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="mt-2 text-sm text-gray-600 font-zen-kaku-gothic">
                ユーザーの予約状況を確認・管理します。
              </p>
              <div className="mt-4">
                <button
                  onClick={() => router.push("/admin/reservations")}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-700 hover:bg-gray-800 font-zen-kaku-gothic"
                >
                  管理する
                </button>
              </div>
            </div>

            {/* ユーザー管理 */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 font-zen-kaku-gothic">
                  ユーザー管理
                </h2>
                <svg
                  className="h-8 w-8 text-gray-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <p className="mt-2 text-sm text-gray-600 font-zen-kaku-gothic">
                ユーザーアカウントの管理を行います。
              </p>
              <div className="mt-4">
                <button
                  onClick={() => router.push("/admin/users")}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-700 hover:bg-gray-800 font-zen-kaku-gothic"
                >
                  管理する
                </button>
              </div>
            </div>

            {/* カード発行 */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 font-zen-kaku-gothic">
                  テスト用カード発行
                </h2>
                <svg
                  className="h-8 w-8 text-gray-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <p className="mt-2 text-sm text-gray-600 font-zen-kaku-gothic">
                入室カードの手動発行を行います。
              </p>
              <div className="mt-4">
                <button
                  onClick={() => router.push("/admin/cards")}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-700 hover:bg-gray-800 font-zen-kaku-gothic"
                >
                  管理する
                </button>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </Layout>
  );
}
