"use client";

import { useEffect, useRef, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Layout from "@/components/Layout";
import { auth } from "@/utils/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

// 将使用 useSearchParams 的逻辑分离到单独组件
function PaymentCancelledContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cleanupExecuted = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const lockId = searchParams.get('lockId');

  // 监听Firebase认证状态
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 等待认证状态确定后再执行清理
  useEffect(() => {
    // 如果还在加载认证状态，等待
    if (authLoading) {
      console.log("正在等待认证状态加载...");
      return;
    }

    // 防止重复执行清理逻辑
    if (cleanupExecuted.current) return;
    cleanupExecuted.current = true;

    const cleanupLock = async () => {
      if (!lockId) {
        console.log("没有锁定ID，跳过清理");
        return;
      }

      console.log("开始清理锁定，用户状态:", user ? "已登录" : "未登录", "锁定ID:", lockId);

      try {
        if (!user) {
          console.error("用户未登录，无法清理锁定");
          return;
        }

        const idToken = await user.getIdToken();
        
        console.log("正在调用清理API...");
        const response = await fetch("/api/cancel-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({ lockId }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log("锁定清理成功:", result.message);
        } else {
          const errorText = await response.text();
          console.error("锁定清理失败:", {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
        }
      } catch (error) {
        console.error("清理锁定时出错:", error);
      }
    };

    cleanupLock();
  }, [lockId, user, authLoading]); // 添加 user 和 authLoading 作为依赖

  const handleBackToHome = () => {
    router.push("/");
  };

  return (
    <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
      <div className="space-y-6">
        <div className="space-y-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-700 font-zen-kaku-gothic">
            お支払いがキャンセルされました
          </h1>
          <p className="text-gray-700 font-zen-kaku-gothic">
            予約手続きがキャンセルされました。
          </p>
          <p className="text-gray-700 font-zen-kaku-gothic">
            再度予約をご希望の場合は、最初からお手続きください。
          </p>

          {/* 显示清理状态 */}
          {/* {lockId && (
            <div className="text-sm text-gray-500 font-zen-kaku-gothic">
              {authLoading ? (
                <p>🔄 予約状態を確認中...</p>
              ) : user ? (
                <p>✅ 予約データを整理しました</p>
              ) : (
                <p>⚠️ ログイン状態を確認してください</p>
              )}
            </div>
          )} */}
        </div>

        <div className="pt-6">
          <button
            onClick={handleBackToHome}
            className="px-8 md:px-12 py-2 md:py-3 text-sm md:text-base font-medium text-white bg-gray-700 rounded-full hover:bg-gray-800 font-zen-kaku-gothic"
          >
            トップページに戻る
          </button>
        </div>
      </div>
    </div>
  );
}

// 主组件，使用 Suspense 包装
export default function PaymentCancelled() {
  return (
    <Layout>
      <Suspense 
        fallback={
          <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
            <div className="space-y-4">
              <h1 className="text-xl md:text-2xl font-bold text-gray-700 font-zen-kaku-gothic">
                読み込み中...
              </h1>
            </div>
          </div>
        }
      >
        <PaymentCancelledContent />
      </Suspense>
    </Layout>
  );
}