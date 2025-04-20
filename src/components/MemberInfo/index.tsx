"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import { getUserData, updateUserData } from "@/utils/auth";

interface MemberFormData {
  name: string;
  email: string;
  phone: string;
  birthdate: string;
  gender: "male" | "female" | "";
  fullName: string;
}

export default function MemberInfo() {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();
  const [formData, setFormData] = useState<MemberFormData>({
    name: "",
    email: "",
    phone: "",
    birthdate: "",
    gender: "",
    fullName: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [metadataLoaded, setMetadataLoaded] = useState(false);

  // 使用useCallback包装获取最新用户元数据的函数
  const fetchLatestUserMetadata = useCallback(async () => {
    if (!user) return;

    try {
      const { success, data } = await getUserData(user.uid);

      if (success && data) {
        setFormData((prev) => ({
          ...prev,
          email: user.email || prev.email,
          name: user.displayName || prev.name,
          phone: data.phone || prev.phone,
          birthdate: data.birthdate || prev.birthdate,
          gender: data.gender || prev.gender,
          fullName: data.fullName || prev.fullName || user.displayName || "",
        }));
        // 标记元数据已加载
        setMetadataLoaded(true);
      }
    } catch (error) {
      console.error("Error fetching user metadata:", error);
    }
  }, [user]);

  // 当获取到Firebase用户信息后，加载表单数据
  useEffect(() => {
    if (user) {
      // 设置基本信息
      setFormData((prev) => ({
        ...prev,
        email: user.email || "",
        name: user.displayName || "",
        fullName: user.displayName || "",
      }));

      // 获取用户的完整元数据
      fetchLatestUserMetadata();
    }
  }, [user, fetchLatestUserMetadata]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      // 调用Firebase API更新用户元数据
      const { success, error } = await updateUserData(user.uid, {
        phone: formData.phone,
        birthdate: formData.birthdate,
        gender: formData.gender as "male" | "female" | "",
        fullName: formData.fullName,
      });

      if (!success) {
        throw new Error(error || "更新用户信息失败");
      }

      // 保存成功
      setSaveSuccess(true);
      setIsEditing(false);
      // 保存成功后重新获取最新的元数据
      fetchLatestUserMetadata();
    } catch (error) {
      console.error("Error updating user metadata:", error);
      setSaveError("ユーザー情報の更新中にエラーが発生しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGenderChange = (selectedGender: string) => {
    setFormData((prev) => ({
      ...prev,
      gender: selectedGender as "male" | "female" | "",
    }));
  };

  // 修改处理编辑按钮点击事件，隐藏成功消息
  const handleEditClick = () => {
    setIsEditing(true);
    setSaveSuccess(false);
  };

  // 处理加载状态
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-[#444444] font-zen-kaku-gothic">読み込み中...</p>
      </div>
    );
  }

  // 处理未登录状态
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-[#444444] font-zen-kaku-gothic">
          会員情報を表示するには、ログインしてください。
        </p>
        <a
          href="/login"
          className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
        >
          ログイン
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-[920px] mx-auto space-y-8 md:space-y-16">
      {/* 会員情報 */}
      <div className="space-y-4 md:space-y-6">
        <div className="border-b border-[rgba(68,68,68,0.2)] pb-2 md:pb-4">
          <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
            会員情報
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="space-y-3 md:space-y-4">
            {/* メールアドレス */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label
                htmlFor="email"
                className="block text-[#444444] font-zen-kaku-gothic md:w-1/3 text-[12px] md:text-base mb-1 md:mb-0"
              >
                メールアドレス
              </label>
              <div className="w-full md:w-2/3">
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border border-[#BBBBBB] px-3 md:px-4 py-2 rounded-md text-[#444444] font-zen-kaku-gothic bg-gray-100 text-[12px] md:text-base"
                  disabled={true}
                />
              </div>
            </div>

            {/* お名前（可编辑） */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label
                htmlFor="fullName"
                className="block text-[#444444] font-zen-kaku-gothic md:w-1/3 text-[12px] md:text-base mb-1 md:mb-0"
              >
                お名前
              </label>
              <div className="w-full md:w-2/3">
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={`w-full border border-[#BBBBBB] px-3 md:px-4 py-2 rounded-md text-[#444444] font-zen-kaku-gothic text-[12px] md:text-base ${
                    isEditing ? "bg-white" : "bg-gray-100"
                  }`}
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* 電話番号 */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label
                htmlFor="phone"
                className="block text-[#444444] font-zen-kaku-gothic md:w-1/3 text-[12px] md:text-base mb-1 md:mb-0"
              >
                電話番号
              </label>
              <div className="w-full md:w-2/3">
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full border border-[#BBBBBB] px-3 md:px-4 py-2 rounded-md text-[#444444] font-zen-kaku-gothic text-[12px] md:text-base ${
                    isEditing ? "bg-white" : "bg-gray-100"
                  }`}
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* 生年月日 */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label
                htmlFor="birthdate"
                className="block text-[#444444] font-zen-kaku-gothic md:w-1/3 text-[12px] md:text-base mb-1 md:mb-0"
              >
                生年月日
              </label>
              <div className="w-full md:w-2/3">
                <input
                  id="birthdate"
                  type="date"
                  name="birthdate"
                  value={formData.birthdate}
                  onChange={handleChange}
                  className={`w-full border border-[#BBBBBB] px-3 md:px-4 py-2 rounded-md text-[#444444] font-zen-kaku-gothic text-[12px] md:text-base ${
                    isEditing ? "bg-white" : "bg-gray-100"
                  }`}
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* 性別 */}
            <div className="flex flex-col md:flex-row md:items-center">
              <span className="block text-[#444444] font-zen-kaku-gothic md:w-1/3 text-[12px] md:text-base mb-1 md:mb-0">
                性別
              </span>
              <div className="w-full md:w-2/3 flex flex-row space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={formData.gender === "male"}
                    onChange={() => handleGenderChange("male")}
                    disabled={!isEditing}
                    className="mr-2"
                  />
                  <span className="text-[#444444] font-zen-kaku-gothic text-[12px] md:text-base">
                    男性
                  </span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={formData.gender === "female"}
                    onChange={() => handleGenderChange("female")}
                    disabled={!isEditing}
                    className="mr-2"
                  />
                  <span className="text-[#444444] font-zen-kaku-gothic text-[12px] md:text-base">
                    女性
                  </span>
                </label>
              </div>
            </div>

            {/* アクション */}
            <div className="pt-4 flex justify-center md:justify-end space-x-4">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-1 border border-[#444444] text-[#444444] rounded-full text-[12px] md:text-[14px] font-zen-kaku-gothic"
                    disabled={isSaving}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-1 bg-[#444444] text-white rounded-full text-[12px] md:text-[14px] font-zen-kaku-gothic"
                    disabled={isSaving}
                  >
                    {isSaving ? "保存中..." : "保存する"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="px-6 py-1 bg-[#444444] text-white rounded-full text-[12px] md:text-[14px] font-zen-kaku-gothic"
                >
                  編集する
                </button>
              )}
            </div>

            {/* 成功メッセージ */}
            {saveSuccess && (
              <div className="pt-2 text-center">
                <p className="text-green-600 text-[12px] md:text-[14px] font-zen-kaku-gothic">
                  ユーザー情報が正常に更新されました。
                </p>
              </div>
            )}

            {/* エラーメッセージ */}
            {saveError && (
              <div className="pt-2 text-center">
                <p className="text-red-600 text-[12px] md:text-[14px] font-zen-kaku-gothic">
                  {saveError}
                </p>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
