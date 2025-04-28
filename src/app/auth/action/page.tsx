"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthActionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleRedirect = () => {
      const mode = searchParams.get("mode");
      const oobCode = searchParams.get("oobCode");

      if (!oobCode) {
        setError("無効な操作リンクです。認証コードがありません。");
        setLoading(false);
        return;
      }

      try {
        // 根据mode参数重定向到不同页面
        if (mode === "resetPassword") {
          // 重定向到密码重置页面，并传递oobCode
          router.push(`/reset-password?oobCode=${oobCode}`);
        } else if (mode === "verifyEmail") {
          // 重定向到邮箱验证页面，并传递oobCode
          router.push(`/email-verification?oobCode=${oobCode}`);
        } else {
          setError("不明な操作タイプです。");
          setLoading(false);
        }
      } catch (error) {
        console.error("リダイレクト処理エラー:", error);
        setError("リクエストの処理中にエラーが発生しました。");
        setLoading(false);
      }
    };

    handleRedirect();
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
        <h1 className="text-2xl font-bold text-[#444444] mb-4 text-center font-zen-kaku-gothic">
          操作に失敗しました
        </h1>
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700 font-zen-kaku-gothic">{error}</p>
        </div>
        <div className="text-center">
          <button
            onClick={() => router.push("/")}
            className="bg-[#444444] text-white py-2 px-6 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic"
          >
            ホームページへ戻る
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function AuthActionHandler() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700"></div>
      </div>
    }>
      <AuthActionContent />
    </Suspense>
  );
} 