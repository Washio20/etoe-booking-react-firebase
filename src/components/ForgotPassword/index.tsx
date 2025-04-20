"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/utils/auth";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("メールアドレスを入力してください。");
      return;
    }

    setLoading(true);

    try {
      // 调用密码重置功能
      const { success, error } = await resetPassword(email);

      if (success) {
        // 重置邮件发送成功
        setResetSent(true);
      } else {
        // 处理错误
        let errorMessage = "パスワードリセットメールの送信に失敗しました。";

        if (error?.code === "auth/user-not-found") {
          errorMessage = "このメールアドレスのユーザーが見つかりません。";
        } else if (error?.code === "auth/invalid-email") {
          errorMessage = "無効なメールアドレスです。";
        } else if (error?.code === "auth/too-many-requests") {
          errorMessage =
            "リクエスト回数が多すぎます。しばらく経ってから再度お試しください。";
        }

        setError(errorMessage);
      }
    } catch (err) {
      console.error("Password reset error:", err);
      setError("パスワードリセットメールの送信中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 重置邮件发送成功的确认页面
  if (resetSent) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-[#444444] mb-4 text-center font-zen-kaku-gothic">
          リセットメール送信完了
        </h1>

        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
          <p className="text-green-700 font-zen-kaku-gothic mb-2">
            パスワードリセットメールを送信しました。
          </p>
          <p className="text-green-700 text-sm font-zen-kaku-gothic">
            {email}{" "}
            に送信されたリンクをクリックして、パスワードをリセットしてください。
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => router.push("/login")}
            className="w-full bg-[#444444] text-white py-2 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic"
          >
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-[#444444] mb-6 text-center font-zen-kaku-gothic">
        パスワードをお忘れの方
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="mb-6">
        <p className="text-[#444444] text-sm font-zen-kaku-gothic">
          登録したメールアドレスを入力してください。パスワードリセット用のリンクを送信します。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* メールアドレス */}
        <div>
          <label
            htmlFor="email"
            className="block text-[#444444] text-sm font-medium mb-1 font-zen-kaku-gothic"
          >
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444]"
            placeholder="example@mail.com"
            required
          />
        </div>

        {/* 送信ボタン */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#444444] text-white py-2 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic disabled:opacity-50"
          >
            {loading ? "送信中..." : "リセットメールを送信"}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center">
        <p className="text-[#444444] text-sm font-zen-kaku-gothic">
          <Link
            href="/login"
            className="text-[#444444] underline hover:text-[#666666]"
          >
            ログインページへ戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
