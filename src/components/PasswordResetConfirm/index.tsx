"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PasswordResetConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [verificationFailed, setVerificationFailed] = useState(false);

  // 获取URL中的重置令牌 - 使用自定义的token参数
  const token = searchParams.get("token");

  // 验证重置令牌
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        console.error("Token missing from URL parameters");
        setVerifying(false);
        setVerificationFailed(true);
        setError("無効なリセットリンクです。トークンが見つかりません。");
        return;
      }

      try {
        // 调用API验证令牌
        const response = await fetch(`/api/auth/reset-password?token=${token}`);
        const data = await response.json();

        if (data.valid) {
          setVerifying(false);
        } else {
          setVerifying(false);
          setVerificationFailed(true);
          setError(data.error || "リセットリンクが無効です。");
        }
      } catch (error) {
        console.error("トークンの検証に失敗しました:", error);
        setVerifying(false);
        setVerificationFailed(true);
        setError("リセットリンクの検証中にエラーが発生しました。");
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 验证密码
    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください。");
      return;
    }

    if (password !== confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "パスワードリセットに失敗しました。");
      }
    } catch (error: any) {
      console.error("パスワードリセットに失敗しました:", error);
      setError("パスワードリセット中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700 mb-4"></div>
        <p>リセットリンクを確認中...</p>
      </div>
    );
  }

  if (verificationFailed) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
        <div className="text-center mt-4">
          <a href="/forgot-password" className="text-blue-600 hover:underline">
            パスワード再設定ページへ
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-green-50 border-l-4 border-green-500 p-6 mb-6">
          <h2 className="text-2xl font-bold text-green-800 mb-2">
            パスワードリセット完了
          </h2>
          <p className="text-green-700 mb-4">
            パスワードを正常にリセットしました。新しいパスワードでログインしてください。
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full bg-[#444444] text-white py-2 rounded-full hover:bg-[#333333] transition-colors"
          >
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">新しいパスワードを設定</h2>
      <p className="mb-6">
        新しいパスワードを設定してください
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              新しいパスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444] text-black"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">6文字以上</p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium mb-1"
            >
              パスワード(確認)
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setConfirmPassword(e.target.value)
              }
              className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444] text-black"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#444444] text-white py-2 rounded-full hover:bg-[#333333] transition-colors"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                設定中...
              </>
            ) : (
              "パスワードを設定"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
