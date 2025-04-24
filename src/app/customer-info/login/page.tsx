"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";

export default function LoginRegisterPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  // 处理登录
  const handleLogin = () => {
    // 在实际应用中，这里应该有登录逻辑

    // 登录成功后跳转到预约确认页面
    router.push("/reservation/confirm");
  };

  // 处理注册并继续
  const handleRegister = () => {
    // 在实际应用中，这里应该有注册逻辑

    // 注册成功后跳转到预约确认页面
    router.push("/reservation/confirm");
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-4 md:py-8 space-y-8">
        <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
          <h1 className="text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
            予約者情報
          </h1>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* 登录部分 */}
          <div className="w-full md:w-1/2">
            <div className="bg-[#F0EAE4] px-4 py-3 mb-4">
              <h2 className="text-[16px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                登録済みの方
              </h2>
            </div>

            <div className="space-y-6">
              <p className="text-[#444444] font-zen-kaku-gothic">
                ログインIDとパスワードを入力してください。
              </p>

              <div className="space-y-2">
                <label
                  htmlFor="loginId"
                  className="block text-[#444444] font-zen-kaku-gothic"
                >
                  ログインID
                </label>
                <input
                  id="loginId"
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full border border-[#BBBBBB] px-4 py-3 rounded-md text-[#444444] font-zen-kaku-gothic"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-[#444444] font-zen-kaku-gothic"
                >
                  パスワード
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-[#BBBBBB] px-4 py-3 rounded-md text-[#444444] font-zen-kaku-gothic"
                />
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleLogin}
                  className="px-20 py-3 text-sm font-medium text-white bg-gray-700 rounded-full hover:bg-gray-800 w-72 whitespace-nowrap"
                >
                  ログインして予約
                </button>
              </div>

              <p className="text-center text-[#444444] font-zen-kaku-gothic">
                ※パスワードの再設定は
                <a href="#" className="text-[#2C3E50] underline">
                  こちら
                </a>
              </p>
            </div>
          </div>

          {/* 注册部分 */}
          <div className="w-full md:w-1/2">
            <div className="bg-[#F0EAE4] px-4 py-3 mb-4">
              <h2 className="text-[16px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                はじめての方
              </h2>
            </div>

            <div className="space-y-6">
              <p className="text-[#444444] font-zen-kaku-gothic">
                会員登録すると次回からはログインIDとパスワードの入力だけで予約できます。
              </p>

              <div className="flex justify-center">
                <button
                  onClick={handleRegister}
                  className="px-20 py-3 text-sm font-medium text-white bg-gray-700 rounded-full hover:bg-gray-800 w-72 whitespace-nowrap"
                >
                  登録して予約
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
