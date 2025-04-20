"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser, resendVerificationEmail } from "@/utils/auth";

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phone: "",
    birthdate: "",
    gender: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
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

    // 简单验证
    if (formData.password !== formData.confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }

    if (formData.password.length < 6) {
      setError("パスワードは6文字以上で入力してください。");
      return;
    }

    if (!formData.fullName.trim()) {
      setError("お名前を入力してください。");
      return;
    }

    if (!formData.phone.trim()) {
      setError("電話番号を入力してください。");
      return;
    }

    if (!formData.birthdate) {
      setError("生年月日を入力してください。");
      return;
    }

    if (!formData.gender) {
      setError("性別を選択してください。");
      return;
    }

    setLoading(true);

    try {
      // 调用注册函数
      const { success, error, data } = await registerUser(
        formData.email,
        formData.password,
        {
          fullName: formData.fullName,
          phone: formData.phone,
          birthdate: formData.birthdate,
          gender: formData.gender as "male" | "female" | "",
        }
      );

      if (success) {
        // 注册成功，显示验证邮件提示
        setRegistrationSuccess(true);
        setRegisteredEmail(formData.email);
        // 不立即跳转，等待用户确认验证邮件
      } else {
        // 处理错误
        let errorMessage = "登録に失敗しました。";

        if (error?.code === "auth/email-already-in-use") {
          errorMessage = "このメールアドレスは既に使用されています。";
        } else if (error?.code === "auth/invalid-email") {
          errorMessage = "無効なメールアドレスです。";
        }

        setError(errorMessage);
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("登録中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 注册成功后的确认信息
  if (registrationSuccess) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-[#444444] mb-4 text-center font-zen-kaku-gothic">
          登録完了
        </h1>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <p className="text-blue-700 font-zen-kaku-gothic mb-2">
            確認メールを送信しました。
          </p>
          <p className="text-blue-700 text-sm font-zen-kaku-gothic">
            {registeredEmail}{" "}
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
        会員登録
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* お名前 */}
        <div>
          <label
            htmlFor="fullName"
            className="block text-[#444444] text-sm font-medium mb-1 font-zen-kaku-gothic"
          >
            お名前 <span className="text-red-500">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            value={formData.fullName}
            onChange={handleChange}
            className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444]"
            placeholder="山田 太郎"
          />
        </div>

        {/* 電話番号 */}
        <div>
          <label
            htmlFor="phone"
            className="block text-[#444444] text-sm font-medium mb-1 font-zen-kaku-gothic"
          >
            電話番号 <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            value={formData.phone}
            onChange={handleChange}
            className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444]"
            placeholder="080-1234-5678"
          />
        </div>

        {/* 生年月日 */}
        <div>
          <label
            htmlFor="birthdate"
            className="block text-[#444444] text-sm font-medium mb-1 font-zen-kaku-gothic"
          >
            生年月日 <span className="text-red-500">*</span>
          </label>
          <input
            id="birthdate"
            name="birthdate"
            type="date"
            required
            value={formData.birthdate}
            onChange={handleChange}
            className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444]"
          />
        </div>

        {/* 性別 */}
        <div>
          <label className="block text-[#444444] text-sm font-medium mb-1 font-zen-kaku-gothic">
            性別 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="gender"
                value="male"
                required
                checked={formData.gender === "male"}
                onChange={handleChange}
                className="mr-2"
              />
              <span className="text-[#444444] text-sm font-zen-kaku-gothic">
                男性
              </span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="gender"
                value="female"
                checked={formData.gender === "female"}
                onChange={handleChange}
                className="mr-2"
              />
              <span className="text-[#444444] text-sm font-zen-kaku-gothic">
                女性
              </span>
            </label>
          </div>
        </div>

        {/* メールアドレス */}
        <div>
          <label
            htmlFor="email"
            className="block text-[#444444] text-sm font-medium mb-1 font-zen-kaku-gothic"
          >
            メールアドレス <span className="text-red-500">*</span>
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
            パスワード <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleChange}
            className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444]"
            placeholder="6文字以上"
          />
        </div>

        {/* パスワード確認 */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-[#444444] text-sm font-medium mb-1 font-zen-kaku-gothic"
          >
            パスワード (確認) <span className="text-red-500">*</span>
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            value={formData.confirmPassword}
            onChange={handleChange}
            className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444]"
            placeholder="パスワードを再入力"
          />
        </div>

        {/* 登録ボタン */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#444444] text-white py-2 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic disabled:opacity-50"
          >
            {loading ? "登録中..." : "登録する"}
          </button>
        </div>
      </form>

      <div className="mt-4 text-center">
        <p className="text-[#444444] text-sm font-zen-kaku-gothic">
          すでにアカウントをお持ちの方は
          <Link
            href="/login"
            className="text-[#444444] underline ml-1 hover:text-[#666666]"
          >
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
