"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginUser, resendVerificationEmail } from "@/utils/auth";

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [returnTo, setReturnTo] = useState<string>("/member");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailVerificationRequired, setEmailVerificationRequired] =
    useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // 获取URL中的returnTo参数
  useEffect(() => {
    const returnToParam = searchParams.get("returnTo");
    if (returnToParam) {
      setReturnTo(returnToParam);
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    setResendSuccess(false);

    try {
      const { success } = await resendVerificationEmail();
      if (success) {
        setResendSuccess(true);
      } else {
        setError("確認メールの再送信に失敗しました。");
      }
    } catch (err) {
      console.error("Failed to resend verification email:", err);
      setError("確認メールの再送信中にエラーが発生しました。");
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailVerificationRequired(false);

    if (!formData.email || !formData.password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }

    setLoading(true);

    try {
      // 调用登录函数
      const { success, error, data } = await loginUser(
        formData.email,
        formData.password
      );

      if (success && data) {
        // 检查邮箱是否已验证
        if (!data.emailVerified) {
          setEmailVerificationRequired(true);
          setLoading(false);
          return;
        }

        // 登录成功且邮箱已验证，跳转到returnTo指定的页面
        router.push(returnTo);
      } else {
        // 处理错误
        let errorMessage = "ログインに失敗しました。";

        if (
          error?.code === "auth/user-not-found" ||
          error?.code === "auth/wrong-password"
        ) {
          errorMessage = "メールアドレスまたはパスワードが正しくありません。";
        } else if (error?.code === "auth/too-many-requests") {
          errorMessage =
            "ログイン試行回数が多すぎます。しばらく経ってから再度お試しください。";
        } else if (error?.code === "auth/invalid-credential") {
          errorMessage = "無効な認証情報です。";
        }

        setError(errorMessage);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("ログイン中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 如果需要邮箱验证，显示相应提示
  if (emailVerificationRequired) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-[#444444] mb-4 text-center font-zen-kaku-gothic">
          メール認証が必要です
        </h1>

        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
          <p className="text-yellow-700 font-zen-kaku-gothic mb-2">
            メールアドレスの認証が完了していません。
          </p>
          <p className="text-yellow-700 text-sm font-zen-kaku-gothic">
            {formData.email}{" "}
            に送信された確認リンクをクリックして、メールアドレスを認証してください。
          </p>
        </div>

        {resendSuccess && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
            確認メールを再送信しました。
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleResendVerification}
            disabled={resendingEmail}
            className="w-full border border-[#444444] text-[#444444] py-2 rounded-full hover:bg-gray-100 transition-colors font-zen-kaku-gothic disabled:opacity-50"
          >
            {resendingEmail ? "送信中..." : "確認メールを再送信"}
          </button>

          <button
            onClick={() => {
              setEmailVerificationRequired(false);
              setError("");
            }}
            className="w-full bg-[#444444] text-white py-2 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic"
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-[#444444] mb-6 text-center font-zen-kaku-gothic">
        ログイン
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

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
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444]"
            placeholder="example@mail.com"
          />
        </div>

        {/* パスワード */}
        <div>
          <label
            htmlFor="password"
            className="block text-[#444444] text-sm font-medium mb-1 font-zen-kaku-gothic"
          >
            パスワード
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleChange}
            className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444]"
          />
        </div>

        {/* ログインボタン */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#444444] text-white py-2 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center space-y-2">
        <p className="text-[#444444] text-sm font-zen-kaku-gothic">
          アカウントをお持ちでない方は
          <Link
            href="/register"
            className="text-[#444444] underline ml-1 hover:text-[#666666]"
          >
            会員登録
          </Link>
        </p>
        <p className="text-[#444444] text-sm font-zen-kaku-gothic">
          <Link
            href="/forgot-password"
            className="text-[#444444] underline hover:text-[#666666]"
          >
            パスワードをお忘れの方
          </Link>
        </p>
      </div>
    </div>
  );
}
