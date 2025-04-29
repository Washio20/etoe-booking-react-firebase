"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import { auth } from "@/utils/firebase";
import { User } from "@/types/user";
import { formatTimestamp } from "@/utils/date";

export default function AdminUsersPage() {
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // 检查管理员权限
  useEffect(() => {
    if (loading) return;

    const checkAdminStatus = async () => {
      if (!user) {
        setAdminState({ isAdmin: false, checkComplete: true });
        return;
      }

      try {
        const idTokenResult = await user.getIdTokenResult(true);
        const isUserAdmin = idTokenResult.claims.admin === true;
        setAdminState({ isAdmin: isUserAdmin, checkComplete: true });
      } catch (error) {
        console.error("管理者権限チェックエラー:", error);
        setAdminState({ isAdmin: false, checkComplete: true });
      }
    };

    checkAdminStatus();
  }, [user, loading]);

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    if (!user || !adminState.isAdmin) return;
    
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const idToken = await user.getIdToken();
      let url = "/api/admin/users";
      
      if (searchEmail) {
        url += `?email=${encodeURIComponent(searchEmail)}`;
      }
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setFilteredUsers(data.users || []);
        setCurrentPage(1);
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.error || "ユーザー情報の取得に失敗しました");
      }
    } catch (error) {
      console.error("Error loading users:", error);
      setErrorMessage("ユーザー情報の読み込み中にエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }, [user, adminState.isAdmin, searchEmail]);

  // 初始加载
  useEffect(() => {
    if (adminState.isAdmin) {
      loadUsers();
    }
  }, [adminState.isAdmin, loadUsers]);

  // 处理搜索
  const handleSearch = () => {
    if (searchEmail) {
      const filtered = users.filter(user => 
        user.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
        (user.fullName && user.fullName.toLowerCase().includes(searchEmail.toLowerCase()))
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
    setCurrentPage(1);
  };

  // 处理重置搜索
  const handleResetSearch = () => {
    setSearchEmail("");
    setFilteredUsers(users);
    setCurrentPage(1);
  };

  // 添加查看详情函数
  const handleViewDetails = (userId: string) => {
    router.push(`/admin/users/${userId}`);
  };

  // 计算分页数据
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  // 切换页面
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // 加载中状态
  if (loading || !adminState.checkComplete) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </Layout>
    );
  }

  // 用户未登录
  if (!user) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic mb-4">
            管理者ページにアクセスするには、ログインしてください。
          </p>
          <button
            onClick={() => router.push("/login?returnTo=/admin/users")}
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
          >
            ログイン
          </button>
        </div>
      </Layout>
    );
  }

  // 非管理员用户
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

  return (
    <Layout>
      <AdminLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-300 pb-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wider font-zen-kaku-gothic">
              ユーザー管理
            </h1>
          </div>

          {/* 検索フォーム */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
              ユーザー検索
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic">
                  メールアドレス/名前
                </label>
                <input
                  type="text"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="メールアドレスまたは名前"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end space-x-2">
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-700"
                >
                  {isLoading ? "検索中..." : "検索"}
                </button>
                <button
                  onClick={handleResetSearch}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-300"
                >
                  リセット
                </button>
              </div>
            </div>
          </div>

          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700 text-sm font-zen-kaku-gothic">
                {errorMessage}
              </p>
            </div>
          )}

          {/* ユーザーリスト */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <h2 className="bg-gray-50 px-4 py-3 text-lg font-medium text-gray-800 font-zen-kaku-gothic border-b border-gray-200">
              ユーザー一覧
            </h2>

            {isLoading ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 font-zen-kaku-gothic">
                  データを読み込み中...
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 font-zen-kaku-gothic">
                  検索条件に一致するユーザーはありません
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        メールアドレス
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        名前
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        性別
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        電話番号
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        登録日
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        最終ログイン
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        メール認証
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentUsers.map((user) => (
                      <tr key={user.uid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.fullName || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.gender === "male" ? "男性" : 
                           user.gender === "female" ? "女性" : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.phone || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimestamp(user.createdAt, "yyyy/MM/dd HH:mm", "未設定")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimestamp(user.lastLogin, "yyyy/MM/dd HH:mm", "未設定")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.emailVerified
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {user.emailVerified ? "認証済み" : "未認証"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewDetails(user.uid)}
                              className="text-sm px-3 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                            >
                              詳細
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* ページネーション */}
                {totalPages > 1 && (
                  <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                          currentPage === 1
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        前へ
                      </button>
                      <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                          currentPage === totalPages
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        次へ
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          全 <span className="font-medium">{filteredUsers.length}</span> 件中{" "}
                          <span className="font-medium">{indexOfFirstItem + 1}</span> から{" "}
                          <span className="font-medium">
                            {Math.min(indexOfLastItem, filteredUsers.length)}
                          </span> 件を表示
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                              currentPage === 1
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <span className="sr-only">前へ</span>
                            &laquo;
                          </button>
                          {[...Array(totalPages)].map((_, i) => (
                            <button
                              key={i}
                              onClick={() => paginate(i + 1)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === i + 1
                                  ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                  : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                          <button
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                              currentPage === totalPages
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <span className="sr-only">次へ</span>
                            &raquo;
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </Layout>
  );
} 