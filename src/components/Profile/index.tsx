"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentUser,
  getUserData,
  updateUserData,
  logoutUser,
  UserData,
} from "@/utils/auth";
import { User } from "firebase/auth";

export default function Profile() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    birthdate: "",
    gender: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // 页面加载时获取用户数据
  useEffect(() => {
    // 获取当前登录用户
    const user = getCurrentUser();

    if (user) {
      setCurrentUser(user);

      // 从 Firestore 获取用户数据
      const fetchUserData = async () => {
        const { success, data } = await getUserData(user.uid);

        if (success && data) {
          setUserData(data);
          setFormData({
            fullName: data.fullName || "",
            phone: data.phone || "",
            birthdate: data.birthdate || "",
            gender: data.gender || "",
          });
        }

        setIsLoading(false);
      };

      fetchUserData();
    } else {
      // 如果用户未登录，重定向到登录页面
      router.push("/login");
    }
  }, [router]);

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

  const handleEditClick = () => {
    setIsEditing(true);
    setSaveSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      router.push("/login");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      // 更新用户数据
      const { success, error } = await updateUserData(currentUser.uid, {
        fullName: formData.fullName,
        phone: formData.phone,
        birthdate: formData.birthdate,
        gender: formData.gender as "male" | "female" | "",
      });

      if (success) {
        // 保存成功
        setSaveSuccess(true);
        setIsEditing(false);

        // 更新本地数据
        if (userData) {
          setUserData({
            ...userData,
            fullName: formData.fullName,
            phone: formData.phone,
            birthdate: formData.birthdate,
            gender: formData.gender as "male" | "female" | "",
          });
        }
      } else {
        setSaveError("更新用户信息失败: " + error);
      }
    } catch (error) {
      console.error("Error updating user data:", error);
      setSaveError("更新用户信息时发生错误");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // 处理加载状态
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-[#444444] font-zen-kaku-gothic">読み込み中...</p>
      </div>
    );
  }

  // 处理未登录状态
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-[#444444] font-zen-kaku-gothic">
          会員情報を表示するには、ログインしてください。
        </p>
        <button
          onClick={() => router.push("/login")}
          className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
        >
          ログイン
        </button>
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
                className="block text-[#444444] font-zen-kaku-gothic md:w-1/3 text-sm mb-1 md:mb-0"
              >
                メールアドレス
              </label>
              <div className="w-full md:w-2/3">
                <input
                  id="email"
                  type="email"
                  value={currentUser?.email || ""}
                  className="w-full border border-[#BBBBBB] rounded-md px-3 py-2 text-[#444444] font-zen-kaku-gothic bg-gray-100"
                  disabled={true}
                />
              </div>
            </div>

            {/* お名前（可编辑） */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label
                htmlFor="fullName"
                className="block text-[#444444] font-zen-kaku-gothic md:w-1/3 text-sm mb-1 md:mb-0"
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
                  className={`w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444] font-zen-kaku-gothic ${
                    !isEditing ? "bg-gray-100" : ""
                  } text-black`}
                  disabled={!isEditing}
                  placeholder="例: 山田 太郎"
                />
              </div>
            </div>

            {/* 電話番号 */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label
                htmlFor="phone"
                className="block text-[#444444] font-zen-kaku-gothic md:w-1/3 text-sm mb-1 md:mb-0"
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
                  className={`w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444] font-zen-kaku-gothic ${
                    !isEditing ? "bg-gray-100" : ""
                  } text-black`}
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* 生年月日 */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label
                htmlFor="birthdate"
                className="block text-[#444444] font-zen-kaku-gothic md:w-1/3 text-sm mb-1 md:mb-0"
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
                  className={`w-full border border-[#BBBBBB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#444444] font-zen-kaku-gothic ${
                    !isEditing ? "bg-gray-100" : ""
                  } text-black`}
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* 性別 */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label className="block text-[#444444] font-zen-kaku-gothic md:w-1/3 text-sm mb-1 md:mb-0">
                性別
              </label>
              <div className="w-full md:w-2/3 flex gap-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={formData.gender === "male"}
                    onChange={() => handleGenderChange("male")}
                    className="mr-2"
                    disabled={!isEditing}
                  />
                  <span className="text-[#444444] font-zen-kaku-gothic text-sm">
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
                    className="mr-2"
                    disabled={!isEditing}
                  />
                  <span className="text-[#444444] font-zen-kaku-gothic text-sm">
                    女性
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* 状态消息 */}
          {saveSuccess && (
            <div className="mt-4 p-2 bg-emerald-100 text-emerald-700 rounded text-center text-sm">
              会員情報が正常に更新されました。
            </div>
          )}
          {saveError && (
            <div className="mt-4 p-2 bg-red-100 text-red-800 rounded text-center text-sm">
              {saveError}
            </div>
          )}

          <div className="mt-6 md:mt-8 flex justify-center gap-3 md:gap-4">
            {!isEditing ? (
              <button
                type="button"
                onClick={handleEditClick}
                className="px-10 md:px-20 py-2 md:py-3 text-sm font-medium text-white bg-gray-700 rounded-full hover:bg-gray-800 w-full md:w-72 whitespace-nowrap"
              >
                編集する
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 md:px-8 py-2 md:py-3 text-sm font-medium text-gray-700 bg-gray-200 rounded-full hover:bg-gray-300"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 md:px-8 py-2 md:py-3 text-sm font-medium text-white bg-gray-700 rounded-full hover:bg-gray-800"
                  disabled={isSaving}
                >
                  {isSaving ? "保存中..." : "保存する"}
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* ログアウトボタン */}
      <div className="max-w-2xl mx-auto text-center mt-8">
        <button
          onClick={handleLogout}
          className="px-6 py-2 border border-[#444444] text-[#444444] rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#f5f5f5] transition-colors"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
