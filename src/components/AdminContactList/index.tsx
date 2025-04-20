"use client";

import { useState, useEffect, useCallback } from "react";
import { auth } from "@/utils/firebase";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// 联系表单数据类型
interface ContactData {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  content: string;
  status: string;
  userId?: string | null;
  userEmail?: string;
  adminComment?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  handledBy?: string;
  handledAt?: Date;
}

// 状态选项
const STATUS_OPTIONS = [
  { value: "pending", label: "未対応", color: "bg-yellow-100 text-yellow-800" },
  { value: "processing", label: "対応中", color: "bg-blue-100 text-blue-800" },
  { value: "completed", label: "完了", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "却下", color: "bg-red-100 text-red-800" },
];

export default function AdminContactList() {
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactData | null>(
    null
  );
  const [updateLoading, setUpdateLoading] = useState(false);
  const [adminComment, setAdminComment] = useState("");
  const [newStatus, setNewStatus] = useState("");

  // 获取联系表单数据
  const fetchContacts = useCallback(
    async (startAfter: string | null = null) => {
      try {
        setLoading(true);
        setError(null);

        // 获取用户的ID令牌
        const user = auth.currentUser;
        if (!user) {
          throw new Error("ログインが必要です");
        }

        const token = await user.getIdToken();

        // 创建URL，附带查询参数
        const url = new URL("/api/contacts", window.location.origin);
        url.searchParams.append("limit", "10"); // 每页10条
        if (startAfter) {
          url.searchParams.append("startAfter", startAfter);
        }

        // 发送请求获取联系表单数据
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "データの取得に失敗しました");
        }

        // 解析响应数据
        const data = await response.json();
        const {
          contacts: newContacts,
          lastDoc: newLastDoc,
          hasMore: newHasMore,
        } = data;

        // 更新状态
        if (startAfter) {
          // 追加模式
          setContacts((prev) => [...prev, ...newContacts]);
        } else {
          // 替换模式
          setContacts(newContacts);
        }

        setLastDoc(newLastDoc);
        setHasMore(newHasMore);
      } catch (error) {
        console.error("获取联系表单失败:", error);
        setError(
          "データの読み込みに失敗しました。後でもう一度お試しください。"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 初始加载数据
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // 处理加载更多
  const handleLoadMore = () => {
    if (hasMore && lastDoc) {
      fetchContacts(lastDoc);
    }
  };

  // 打开联系表单详情
  const handleOpenDetail = (contact: ContactData) => {
    setSelectedContact(contact);
    setAdminComment(contact.adminComment || "");
    setNewStatus(contact.status || "pending");
  };

  // 关闭详情模态框
  const handleCloseDetail = () => {
    setSelectedContact(null);
    setAdminComment("");
    setNewStatus("");
  };

  // 更新联系表单状态
  const handleUpdateStatus = async () => {
    if (!selectedContact) return;

    try {
      setUpdateLoading(true);

      // 获取用户的ID令牌
      const user = auth.currentUser;
      if (!user) {
        throw new Error("ログインが必要です");
      }

      const token = await user.getIdToken();

      // 发送PATCH请求更新联系表单状态
      const response = await fetch("/api/contacts", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: selectedContact.id,
          status: newStatus,
          adminComment: adminComment.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "状態の更新に失敗しました");
      }

      // 更新成功后刷新数据
      fetchContacts();
      handleCloseDetail();
    } catch (error) {
      console.error("更新联系表单状态失败:", error);
      alert("更新に失敗しました。もう一度お試しください。");
    } finally {
      setUpdateLoading(false);
    }
  };

  // 获取状态标签样式
  const getStatusBadgeClass = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(
      (option) => option.value === status
    );
    return statusOption?.color || "bg-gray-100 text-gray-800";
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(
      (option) => option.value === status
    );
    return statusOption?.label || "未設定";
  };

  // 格式化日期
  const formatDate = (date: Date | null) => {
    if (!date) return "未設定";
    return format(date, "yyyy年MM月dd日 HH:mm", { locale: ja });
  };

  // 显示加载中状态
  if (loading && contacts.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
      </div>
    );
  }

  // 显示错误信息
  if (error && contacts.length === 0) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 font-zen-kaku-gothic">
              エラーが発生しました
            </h3>
            <div className="mt-2 text-sm text-red-700 font-zen-kaku-gothic">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 显示空数据状态
  if (contacts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 font-zen-kaku-gothic">
          お問い合わせはまだありません
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* 联系表单列表 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
              >
                ID
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
              >
                名前
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
              >
                タイトル
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
              >
                日時
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
              >
                状態
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
              >
                アクション
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 font-zen-kaku-gothic">
                  {contact.id.substring(0, 6)}...
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-zen-kaku-gothic">
                  {contact.name}
                </td>
                <td className="px-3 py-4 text-sm text-gray-900 font-zen-kaku-gothic truncate max-w-[200px]">
                  {contact.title}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 font-zen-kaku-gothic">
                  {formatDate(contact.createdAt)}
                </td>
                <td className="px-3 py-4 whitespace-nowrap font-zen-kaku-gothic">
                  <span
                    className={`inline-flex px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(
                      contact.status
                    )}`}
                  >
                    {getStatusText(contact.status)}
                  </span>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium font-zen-kaku-gothic">
                  <button
                    onClick={() => handleOpenDetail(contact)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    詳細
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 加载更多按钮 */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className={`px-4 py-2 border border-gray-300 rounded-md text-sm font-zen-kaku-gothic ${
              loading
                ? "bg-gray-100 text-gray-500"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {loading ? "読み込み中..." : "もっと見る"}
          </button>
        </div>
      )}

      {/* 详情模态框 */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 font-zen-kaku-gothic">
                  お問い合わせ詳細
                </h3>
                <button
                  onClick={handleCloseDetail}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 font-zen-kaku-gothic">
                      名前
                    </p>
                    <p className="mt-1 text-sm text-gray-900 font-zen-kaku-gothic">
                      {selectedContact.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 font-zen-kaku-gothic">
                      メールアドレス
                    </p>
                    <p className="mt-1 text-sm text-gray-900 font-zen-kaku-gothic">
                      {selectedContact.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 font-zen-kaku-gothic">
                      電話番号
                    </p>
                    <p className="mt-1 text-sm text-gray-900 font-zen-kaku-gothic">
                      {selectedContact.phone}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 font-zen-kaku-gothic">
                      日時
                    </p>
                    <p className="mt-1 text-sm text-gray-900 font-zen-kaku-gothic">
                      {formatDate(selectedContact.createdAt)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 font-zen-kaku-gothic">
                    タイトル
                  </p>
                  <p className="mt-1 text-sm text-gray-900 font-zen-kaku-gothic">
                    {selectedContact.title}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 font-zen-kaku-gothic">
                    内容
                  </p>
                  <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-100 min-h-[100px]">
                    <p className="text-sm text-gray-900 font-zen-kaku-gothic whitespace-pre-line">
                      {selectedContact.content}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 font-zen-kaku-gothic mb-2">
                    ステータス更新
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="status"
                        className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic"
                      >
                        状態
                      </label>
                      <select
                        id="status"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md font-zen-kaku-gothic"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="adminComment"
                        className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic"
                      >
                        管理者コメント
                      </label>
                      <textarea
                        id="adminComment"
                        rows={3}
                        value={adminComment}
                        onChange={(e) => setAdminComment(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-zen-kaku-gothic"
                        placeholder="内部メモとして使用するコメントを入力してください"
                      />
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={handleCloseDetail}
                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none font-zen-kaku-gothic"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={handleUpdateStatus}
                        disabled={updateLoading}
                        className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none font-zen-kaku-gothic"
                      >
                        {updateLoading ? "更新中..." : "更新する"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
