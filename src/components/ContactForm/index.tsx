"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  title: string;
  content: string;
}

// 如果环境变量 NEXT_PUBLIC_USE_CONTACT_API 设置为 true，则使用 API 路由而不是直接使用 Firestore
const useContactApi = process.env.NEXT_PUBLIC_USE_CONTACT_API === "true";

export default function ContactForm() {
  const router = useRouter();
  const [user] = useAuthState(auth);
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    phone: "",
    title: "",
    content: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const submitViaApi = async (): Promise<boolean> => {
    try {
      // 通过API路由提交
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // 如果用户已登录，添加认证令牌
      if (user) {
        const token = await user.getIdToken();
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/contacts/submit", {
        method: "POST",
        headers,
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "提交失败");
      }

      return true;
    } catch (error) {
      console.error("通过API提交失败:", error);
      return false;
    }
  };

  const submitViaFirestore = async (): Promise<boolean> => {
    try {
      // 直接使用Firestore提交
      const contactData = {
        ...formData,
        userId: user?.uid || null,
        userEmail: user?.email || formData.email,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "contacts"), contactData);
      return true;
    } catch (error) {
      console.error("直接使用Firestore提交失败:", error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let success = false;

      // 首先尝试主要的提交方法
      if (useContactApi) {
        success = await submitViaApi();
        // 如果API提交失败，尝试直接使用Firestore
        if (!success) {
          success = await submitViaFirestore();
        }
      } else {
        success = await submitViaFirestore();
        // 如果Firestore提交失败，尝试使用API
        if (!success) {
          success = await submitViaApi();
        }
      }

      if (success) {
        // 提交成功后导航到完成页面
        router.push("/contact/complete");
      } else {
        throw new Error("全ての提出方法が失敗しました。");
      }
    } catch (error) {
      console.error("提交失败:", error);
      setError("提交失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 px-4 md:px-0">
      <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
        <h1 className="text-base md:text-2xl font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
          お問い合わせ
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded font-zen-kaku-gothic text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4 md:space-y-4">
          {/* 名前 */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <label className="text-sm font-medium md:w-40 text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              名前
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="名前"
              className="w-full md:w-[460px] px-3 py-2 border border-[#BBBBBB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#444444] font-zen-kaku-gothic text-black"
              required
            />
          </div>

          {/* メールアドレス */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <label className="text-sm font-medium md:w-40 text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              メールアドレス
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="sample@example.com"
              className="w-full md:w-[460px] px-3 py-2 border border-[#BBBBBB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#444444] font-zen-kaku-gothic text-black"
              required
            />
          </div>

          {/* 電話番号 */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <label className="text-sm font-medium md:w-40 text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              電話番号
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="000-0000-0000"
              className="w-full md:w-[460px] px-3 py-2 border border-[#BBBBBB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#444444] font-zen-kaku-gothic text-black"
              required
            />
          </div>

          {/* タイトル */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <label className="text-sm font-medium md:w-40 text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              タイトル
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full md:w-[460px] px-3 py-2 border border-[#BBBBBB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#444444] font-zen-kaku-gothic text-black"
              required
            />
          </div>

          {/* お問い合わせ内容 */}
          <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6">
            <label className="text-sm font-medium md:w-40 text-[#444444] tracking-[0.06em] font-zen-kaku-gothic whitespace-nowrap">
              お問い合わせ内容
            </label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              placeholder="お問い合わせ内容を入力してください"
              rows={6}
              className="w-full md:w-[460px] px-3 py-2 border border-[#BBBBBB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#444444] font-zen-kaku-gothic placeholder:opacity-50 resize-none text-black"
              required
            />
          </div>
        </div>

        <div className="flex justify-center mt-8 md:mt-12">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-8 py-2 md:px-12 md:py-3 bg-[#444444] text-white rounded-full text-sm md:text-base tracking-[0.06em] font-zen-kaku-gothic font-bold ${
              isSubmitting
                ? "opacity-70 cursor-not-allowed"
                : "hover:bg-[#333333]"
            }`}
          >
            {isSubmitting ? "送信中..." : "送信する"}
          </button>
        </div>
      </form>
    </div>
  );
}
