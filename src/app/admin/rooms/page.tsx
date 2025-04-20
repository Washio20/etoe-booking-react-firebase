"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import RoomList from "@/components/AdminRoomList";

export default function AdminRoomsPage() {
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // 修改为使用对象状态
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });

  // 检查用户是否有管理员权限
  useEffect(() => {
    // 如果还在加载用户状态，不执行检查
    if (loading) return;

    const checkAdminStatus = async () => {
      if (!user) {
        setAdminState({ isAdmin: false, checkComplete: true });
        return;
      }

      try {
        // 获取用户的ID令牌
        const idTokenResult = await user.getIdTokenResult(true);

        // 检查自定义声明
        const isUserAdmin = idTokenResult.claims.admin === true;
        setAdminState({ isAdmin: isUserAdmin, checkComplete: true });
      } catch (error) {
        console.error("管理员权限检查失败:", error);
        setAdminState({ isAdmin: false, checkComplete: true });
      }
    };

    checkAdminStatus();
  }, [user, loading]);

  // 加载状态
  if (loading || !adminState.checkComplete) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </Layout>
    );
  }

  // 未登录状态
  if (!user) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic mb-4">
            管理者ページにアクセスするには、ログインしてください。
          </p>
          <button
            onClick={() => router.push("/login?returnTo=/admin/rooms")}
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
          >
            ログイン
          </button>
        </div>
      </Layout>
    );
  }

  // 无管理员权限
  if (!adminState.isAdmin) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic">
            このページにアクセスする権限がありません。
          </p>
        </div>
      </Layout>
    );
  }

  // 管理员页面
  return (
    <Layout>
      <AdminLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-300 pb-4 flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wider font-zen-kaku-gothic">
              客室管理
            </h1>
            <button
              onClick={() => router.push("/admin/rooms/new")}
              className="px-4 py-2 bg-[#AB9F8D] text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-[#9A8F7E] transition-colors"
            >
              新規客室追加
            </button>
          </div>

          <RoomList />
        </div>
      </AdminLayout>
    </Layout>
  );
}
