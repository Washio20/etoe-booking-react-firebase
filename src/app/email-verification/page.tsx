"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { applyActionCode, getAuth } from "firebase/auth";
import Layout from "@/components/Layout";

function EmailVerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      const oobCode = searchParams.get("oobCode");
      
      if (!oobCode) {
        setStatus("error");
        setErrorMessage("認証コードが存在しないか、期限切れです。");
        return;
      }

      try {
        const auth = getAuth();
        await applyActionCode(auth, oobCode);
        
        // 邮箱验证成功
        setStatus("success");
      } catch (error: any) {
        console.error("メール認証に失敗しました:", error);
        setStatus("error");
        
        // 错误处理
        if (error.code === "auth/invalid-action-code") {
          setErrorMessage("認証リンクが無効または期限切れです。");
        } else if (error.code === "auth/user-disabled") {
          setErrorMessage("ユーザーアカウントが無効になっています。");
        } else if (error.code === "auth/user-not-found") {
          setErrorMessage("ユーザーが存在しません。");
        } else {
          setErrorMessage("メール認証中にエラーが発生しました。");
        }
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      {status === "loading" && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mx-auto mb-4"></div>
          <p className="text-[#444444] font-zen-kaku-gothic">メールアドレスを認証中です...</p>
        </div>
      )}

      {status === "success" && (
        <>
          <h1 className="text-2xl font-bold text-[#444444] mb-4 text-center font-zen-kaku-gothic">
            メール認証成功
          </h1>
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
            <p className="text-green-700 font-zen-kaku-gothic">
              メールアドレスの認証が完了しました！
            </p>
          </div>
          <div className="text-center space-y-4">
            <button
              onClick={() => router.push("/login")}
              className="bg-[#444444] text-white py-2 px-6 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic"
            >
              ログインへ
            </button>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-2xl font-bold text-[#444444] mb-4 text-center font-zen-kaku-gothic">
            メール認証失敗
          </h1>
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-red-700 font-zen-kaku-gothic">{errorMessage}</p>
          </div>
          <div className="text-center space-y-4">
            <button
              onClick={() => router.push("/login")}
              className="bg-[#444444] text-white py-2 px-6 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic"
            >
              ログインへ戻る
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function EmailVerificationPage() {
  return (
    <Layout>
      <Suspense fallback={
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mx-auto mb-4"></div>
          <p className="text-[#444444] font-zen-kaku-gothic">読み込み中...</p>
        </div>
      }>
        <EmailVerificationContent />
      </Suspense>
    </Layout>
  );
} 