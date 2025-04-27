"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/utils/firebase";
import Image from "next/image";
import { Room, RoomCategory } from "@/types/room";

export default function AdminRoomList() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RoomCategory | "all">("all");

  // 加载房间数据
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        setError(null);

        // 获取用户的ID令牌
        const user = auth.currentUser;
        if (!user) {
          throw new Error("ログインが必要です");
        }

        const token = await user.getIdToken();

        // 构建URL
        const url = new URL("/api/rooms", window.location.origin);

        // 发送请求获取房间数据
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
        setRooms(data.rooms || []);
      } catch (error) {
        console.error("获取房间数据失败:", error);
        setError(
          "データの読み込みに失敗しました。後でもう一度お試しください。"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  // 处理删除房间
  // const handleDeleteRoom = async (roomId: string) => {
  //   // 确认删除
  //   if (!confirm("この客室を削除してもよろしいですか？")) {
  //     return;
  //   }

  //   try {
  //     // 获取用户的ID令牌
  //     const user = auth.currentUser;
  //     if (!user) {
  //       throw new Error("ログインが必要です");
  //     }

  //     const token = await user.getIdToken();

  //     // 构建URL
  //     const url = new URL("/api/rooms", window.location.origin);
  //     url.searchParams.append("id", roomId);

  //     // 发送删除请求
  //     const response = await fetch(url.toString(), {
  //       method: "DELETE",
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //         "Content-Type": "application/json",
  //       },
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.error || "削除に失敗しました");
  //     }

  //     // 更新房间列表
  //     setRooms((prevRooms) => prevRooms.filter((room) => room.id !== roomId));
  //     alert("客室が削除されました。");
  //   } catch (error) {
  //     console.error("删除房间失败:", error);
  //     alert("削除に失敗しました。もう一度お試しください。");
  //   }
  // };

  // 过滤房间数据
  const filteredRooms =
    filter === "all" ? rooms : rooms.filter((room) => room.category === filter);

  // 获取分类显示文本
  const getCategoryText = (category: RoomCategory): string => {
    switch (category) {
      case "private_sauna":
        return "プライベートサウナ";
      case "sauna_suite":
        return "サウナスイート";
      case "slow_room":
        return "スロールーム";
      default:
        return category;
    }
  };

  // 显示加载中状态
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
      </div>
    );
  }

  // 显示错误信息
  if (error) {
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
  if (rooms.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 font-zen-kaku-gothic mb-4">
          登録された客室はありません
        </p>
        <button
          onClick={() => router.push("/admin/rooms/new")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-indigo-700 transition-colors"
        >
          新規客室を追加
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 筛选选项 */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-full text-sm font-zen-kaku-gothic ${
              filter === "all"
                ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
            }`}
          >
            すべて
          </button>
          <button
            onClick={() => setFilter("private_sauna")}
            className={`px-3 py-1 rounded-full text-sm font-zen-kaku-gothic ${
              filter === "private_sauna"
                ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
            }`}
          >
            プライベートサウナ
          </button>
          <button
            onClick={() => setFilter("sauna_suite")}
            className={`px-3 py-1 rounded-full text-sm font-zen-kaku-gothic ${
              filter === "sauna_suite"
                ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
            }`}
          >
            サウナスイート
          </button>
          <button
            onClick={() => setFilter("slow_room")}
            className={`px-3 py-1 rounded-full text-sm font-zen-kaku-gothic ${
              filter === "slow_room"
                ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
            }`}
          >
            スロールーム
          </button>
        </div>
      </div>

      {/* 房间列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRooms.map((room) => (
          <div
            key={room.id}
            className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="relative h-40">
              <Image
                src={room.thumbnailUrl || "/images/room-placeholder.jpg"}
                alt={room.roomType ? room.roomType.toUpperCase() : "Room Image"}
                fill
                className="object-cover"
              />
              <div className="absolute top-2 right-2">
                <span
                  className={`inline-flex px-2 py-1 text-xs rounded-full font-zen-kaku-gothic ${
                    room.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {room.isActive ? "公開中" : "非公開"}
                </span>
              </div>
              <div className="absolute top-2 left-2">
                <span className="inline-flex px-2 py-1 text-xs rounded-full bg-gray-800 bg-opacity-70 text-white font-zen-kaku-gothic">
                  {getCategoryText(room.category as RoomCategory)}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-900 mb-1 font-zen-kaku-gothic">
                {room.roomType ? room.roomType.toUpperCase() : ""}
              </h3>
              <p className="text-sm text-gray-500 mb-3 font-zen-kaku-gothic">
                {room.description}
              </p>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium text-gray-900 font-zen-kaku-gothic">
                    最低価格: {room.prices?.[0]?.displayPrice || "未設定"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/admin/rooms/edit/${room.id}`)}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-zen-kaku-gothic"
                  >
                    編集
                  </button>
                  {/* <button
                    onClick={() => handleDeleteRoom(room.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-zen-kaku-gothic"
                  >
                    削除
                  </button> */}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
