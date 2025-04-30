"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import ExternalCardGenerator from "@/components/admin/ExternalCardGenerator";

export default function AdminExternalCardsPage() {
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  // 修改初始状态，加入额外的管理权限检查完成指示
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });

  // 管理者権限をチェック
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
            onClick={() => router.push("/login?returnTo=/admin/external-card-issue")}
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
              外部予約サイト用カード発行
            </h1>
          </div>

          <div className="space-y-6">
            <div className="mb-6 max-w-2xl">
              <h2 className="text-lg font-medium text-gray-800 mb-2 font-zen-kaku-gothic">
                外部予約用カード発行について
              </h2>
              <p className="text-sm text-gray-600 font-zen-kaku-gothic">
                Booking.com、Expedia等の外部予約サイトで予約されたお客様のカードを発行する場合は、
                以下のフォームに必要情報を入力してください。お客様にはカード情報がメールで自動送信されます。
              </p>
            </div>

            <ExternalCardGenerator />
          </div>
        </div>
      </AdminLayout>
    </Layout>
  );
} 