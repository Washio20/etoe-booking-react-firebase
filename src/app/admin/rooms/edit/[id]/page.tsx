"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import { RoomType, RoomCategory, PriceInfo, Room } from "@/types/room";
import SlowRoomInventoryCalendar from "@/components/SlowRoomInventoryCalendar";

interface EditRoomPageProps {
  params: {
    id: string;
  };
}

export default function EditRoomPage({ params }: EditRoomPageProps) {
  const router = useRouter();
  const { id } = params;
  const [user, loading, error] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);

  // 修改为使用对象状态
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });

  // 表单状态
  const [formData, setFormData] = useState<Partial<Room>>({
    id: "",
    roomType: "tototo",
    category: "private_sauna",
    imageUrl: "",
    thumbnailUrl: "",
    prices: [
      {
        timeRange: "平日(昼): 10:00-16:00",
        price: 0,
        displayPrice: "¥0",
        timeRangeType: "weekday_day",
      },
      {
        timeRange: "平日(夜): 16:00-25:00",
        price: 0,
        displayPrice: "¥0",
        timeRangeType: "weekday_night",
      },
      {
        timeRange: "土日祝日",
        price: 0,
        displayPrice: "¥0",
        timeRangeType: "weekend",
      },
    ],
    duration: "1.5時間",
    extension: "不可",
    description: "",
    capacity: 2,
    area: 0,
    facilities: [],
    isActive: true,
    displayOrder: 0,
    timeSlots: [],
  });

  // 预设的时间段配置
  const getDefaultTimeSlots = (roomType: string) => {
    switch (roomType) {
      case "tototo":
        return [
          "10:50〜12:20",
          "13:05〜14:35",
          "15:20〜16:50",
          "17:35〜19:05",
          "19:50〜21:20",
          "22:05〜23:35",
          // "00:20〜01:50",
        ];
      case "fuuu":
        return [
          "11:50〜13:20",
          "13:55〜15:25",
          "16:00〜17:30",
          "18:05〜19:35",
          "20:10〜21:40",
          "22:15〜23:45",
          // "00:20〜01:50",
        ];
      case "zabuun":
        return [
          "10:50〜12:20",
          "12:55〜14:25",
          "15:00〜16:30",
          "17:05〜18:35",
          "19:10〜20:40",
          "21:15〜22:45",
          // "23:20〜00:50",
        ];
      case "toron":
        return [
          "10:35〜12:05",
          "12:40〜14:10",
          "14:45〜16:15",
          "16:50〜18:20",
          "18:55〜20:25",
          "21:00〜22:30",
          // "23:05〜00:35",
        ];
      case "sauna_suite":
        return ["14:00〜17:00", "18:30〜21:00"];
      case "slow_room":
        return [
          "9:00〜11:00",
          "11:30〜13:30",
          "14:00〜16:00",
          "16:30〜18:30",
          "19:00〜21:00",
          "21:30〜23:30",
        ];
      default:
        return [];
    }
  };

  // 获取房间默认容量
  const getDefaultRoomCapacity = (roomType: string) => {
    switch (roomType) {
      case "tototo":
      case "fuuu":
      case "zabuun":
      case "toron":
      case "sauna_suite":
        return 1;
      case "slow_room":
        return 10;
      default:
        return 1;
    }
  };

  // 处理房间类型变化
  const handleRoomTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;

    // 更新房间类型
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // 获取该房间类型的默认时间段列表
    const defaultTimeSlots = getDefaultTimeSlots(value);

    // 创建时间段配置
    const timeSlotObjects = defaultTimeSlots.map((timeSlot) => ({
      time: timeSlot,
      maxReservations: getDefaultRoomCapacity(value),
      price: 0,
      pricing: {
        weekday: 0,
        weekend: 0,
      },
    }));

    // 更新表单数据
    setFormData((prev) => ({
      ...prev,
      timeSlots: timeSlotObjects,
      capacity: getDefaultRoomCapacity(value),
    }));
  };

  // 处理时间段价格变化
  const handleTimeSlotPriceChange = (
    index: number,
    priceType: "weekday" | "weekend",
    value: string
  ) => {
    // 移除所有非数字字符
    const numericValue = value.replace(/[^\d]/g, "");
    const price = numericValue ? parseInt(numericValue, 10) : 0;

    setFormData((prev) => {
      const updatedTimeSlots = [...(prev.timeSlots || [])];
      if (updatedTimeSlots[index]) {
        // 创建或更新pricing对象
        const pricing = updatedTimeSlots[index].pricing || {};
        updatedTimeSlots[index] = {
          ...updatedTimeSlots[index],
          pricing: {
            ...pricing,
            [priceType]: price,
          },
        };
      }
      return {
        ...prev,
        timeSlots: updatedTimeSlots,
      };
    });
  };

  // 处理时间段可预约数量变化
  const handleTimeSlotMaxReservationsChange = (
    index: number,
    value: string
  ) => {
    const maxReservations = value ? parseInt(value, 10) : 1;

    setFormData((prev) => {
      const updatedTimeSlots = [...(prev.timeSlots || [])];
      if (updatedTimeSlots[index]) {
        updatedTimeSlots[index] = {
          ...updatedTimeSlots[index],
          maxReservations,
        };
      }
      return {
        ...prev,
        timeSlots: updatedTimeSlots,
      };
    });
  };

  // 管理者权限检查
  useEffect(() => {
    // 如果还在加载用户状态，不执行检查
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

  // 加载房间数据
  useEffect(() => {
    const fetchRoomData = async () => {
      if (!user || !adminState.isAdmin || !adminState.checkComplete) return;

      try {
        setLoadingRoom(true);
        setErrorMessage(null);

        // 获取用户的ID令牌
        const token = await user.getIdToken();

        // 构建URL
        const url = new URL("/api/rooms", window.location.origin);
        url.searchParams.append("id", id);

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
        const roomData = data.rooms?.find((room: Room) => room.id === id);

        if (!roomData) {
          throw new Error("指定された客室が見つかりませんでした");
        }

        // 设置表单数据
        setFormData({
          ...roomData,
          prices: roomData.prices || [],
          timeSlots: roomData.timeSlots || [],
          dailyInventory: roomData.dailyInventory || {},
        });

        // 如果没有时间段数据，添加默认时间段
        if (!roomData.timeSlots || roomData.timeSlots.length === 0) {
          // 获取该房间类型的默认时间段列表
          const defaultTimeSlots = getDefaultTimeSlots(roomData.roomType);

          // 创建时间段配置
          const timeSlotObjects = defaultTimeSlots.map((timeSlot) => ({
            time: timeSlot,
            maxReservations: getDefaultRoomCapacity(roomData.roomType),
            price: 0,
            pricing: {
              weekday: 0,
              weekend: 0,
            },
          }));

          // 更新表单数据
          setFormData((prev) => ({
            ...prev,
            timeSlots: timeSlotObjects,
          }));
        }
      } catch (error) {
        console.error("获取房间数据失败:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "客室データの読み込みに失敗しました"
        );
      } finally {
        setLoadingRoom(false);
      }
    };

    fetchRoomData();
  }, [user, adminState, id]);

  // 处理表单输入变化
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    // 对于roomType字段，使用专门的处理函数
    if (name === "roomType") {
      if (e.target instanceof HTMLSelectElement) {
        handleRoomTypeChange(e as React.ChangeEvent<HTMLSelectElement>);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // 处理复选框变化
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // 处理价格变化
  const handlePriceChange = (index: number, value: string) => {
    // 移除所有非数字字符
    const numericValue = value.replace(/[^\d]/g, "");
    const price = numericValue ? parseInt(numericValue, 10) : 0;

    setFormData((prev) => {
      const updatedPrices = [...(prev.prices || [])];
      updatedPrices[index] = {
        ...updatedPrices[index],
        price,
        displayPrice: `¥${price.toLocaleString()}`,
      };
      return {
        ...prev,
        prices: updatedPrices,
      };
    });
  };

  // 处理设施变化
  const handleFacilityChange = (facility: string) => {
    setFormData((prev) => {
      const currentFacilities = prev.facilities || [];
      if (currentFacilities.includes(facility)) {
        // 如果已经存在，则移除
        return {
          ...prev,
          facilities: currentFacilities.filter((f) => f !== facility),
        };
      } else {
        // 如果不存在，则添加
        return {
          ...prev,
          facilities: [...currentFacilities, facility],
        };
      }
    });
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      // 获取用户的ID令牌
      const idToken = await user?.getIdToken();
      if (!idToken) {
        throw new Error("認証トークンを取得できませんでした");
      }

      // 提交数据到API
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "保存に失敗しました");
      }

      // 保存成功
      const responseData = await response.json();
      alert("客室情報が正常に更新されました！");

      // 返回房间列表页
      router.push("/admin/rooms");
    } catch (error) {
      console.error("保存中のエラー:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "客室の保存中にエラーが発生しました"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ローディング表示
  if (loading || !adminState.checkComplete) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </Layout>
    );
  }

  // 未ログイン時の表示
  if (!user) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic mb-4">
            管理者ページにアクセスするには、ログインしてください。
          </p>
          <button
            onClick={() =>
              router.push(`/login?returnTo=/admin/rooms/edit/${id}`)
            }
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
          >
            ログイン
          </button>
        </div>
      </Layout>
    );
  }

  // 管理者権限がない場合の表示
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

  // 加载房间数据中
  if (loadingRoom) {
    return (
      <Layout>
        <AdminLayout>
          <div className="flex justify-center py-8">
            <p className="text-gray-600 font-zen-kaku-gothic">
              客室データを読み込み中...
            </p>
          </div>
        </AdminLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <AdminLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-300 pb-4 flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wider font-zen-kaku-gothic">
              客室編集: {formData.roomType && formData.roomType.toUpperCase()}
            </h1>
            <button
              onClick={() => router.push("/admin/rooms")}
              className="px-4 py-2 bg-gray-100 rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-200 transition-colors"
            >
              キャンセル
            </button>
          </div>

          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
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
                  <p className="text-sm text-red-700 font-zen-kaku-gothic">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 客室フォーム */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本情報 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
                基本情報
              </h2>
              <div className="space-y-4">
                {/* 客室タイプ */}
                <div>
                  <label
                    htmlFor="roomType"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    客室タイプ <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="roomType"
                    name="roomType"
                    value={formData.roomType}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="tototo">TOTOTO</option>
                    <option value="fuuu">FUUU</option>
                    <option value="zabuun">ZABUUN</option>
                    <option value="toron">TORON</option>
                    <option value="sauna_suite">サウナスイート</option>
                    <option value="slow_room">スロールーム</option>
                  </select>
                </div>

                {/* カテゴリー */}
                <div>
                  <label
                    htmlFor="category"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    カテゴリー <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="private_sauna">プライベートサウナ</option>
                    <option value="sauna_suite">サウナスイート</option>
                    <option value="slow_room">スロールーム</option>
                  </select>
                </div>

                {/* 説明 */}
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    説明 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="例: 定員2名/15㎡/15℃の水風呂付き"
                  />
                </div>

                {/* 画像URL */}
                <div>
                  <label
                    htmlFor="imageUrl"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    画像URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="imageUrl"
                    name="imageUrl"
                    value={formData.imageUrl}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="/images/room-image.jpg"
                  />
                </div>

                {/* サムネイルURL */}
                <div>
                  <label
                    htmlFor="thumbnailUrl"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    サムネイルURL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="thumbnailUrl"
                    name="thumbnailUrl"
                    value={formData.thumbnailUrl}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="/images/room-thumbnail.jpg"
                  />
                </div>
              </div>
            </div>

            {/* 利用情報 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
                利用情報
              </h2>
              <div className="space-y-4">
                {/* 定員 */}
                <div>
                  <label
                    htmlFor="capacity"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    定員 (人) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="capacity"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleInputChange}
                    required
                    min="1"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                {/* 面積 */}
                <div>
                  <label
                    htmlFor="area"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    面積 (㎡) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="area"
                    name="area"
                    value={formData.area}
                    onChange={handleInputChange}
                    required
                    min="1"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                {/* 利用時間 */}
                <div>
                  <label
                    htmlFor="duration"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    利用時間 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="duration"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="例: 1.5時間"
                  />
                </div>

                {/* 延長 */}
                <div>
                  <label
                    htmlFor="extension"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    延長 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="extension"
                    name="extension"
                    value={formData.extension}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="例: 30分/¥2,000円 または 不可"
                  />
                </div>

                {/* 表示順 */}
                <div>
                  <label
                    htmlFor="displayOrder"
                    className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                  >
                    表示順 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="displayOrder"
                    name="displayOrder"
                    value={formData.displayOrder}
                    onChange={handleInputChange}
                    required
                    min="0"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500 font-zen-kaku-gothic">
                    数字が小さいほど先頭に表示されます
                  </p>
                </div>

                {/* 公開状態 */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleCheckboxChange}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="isActive"
                    className="ml-2 block text-sm text-gray-700 font-zen-kaku-gothic"
                  >
                    公開する
                  </label>
                </div>
              </div>
            </div>

            {/* 設備 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
                設備・アメニティ
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  "サウナ",
                  "水風呂",
                  "シャワー",
                  "バスタブ",
                  "トイレ",
                  "製氷機",
                  "ルームシアター",
                  "バルコニー",
                ].map((facility) => (
                  <div key={facility} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`facility-${facility}`}
                      checked={(formData.facilities || []).includes(facility)}
                      onChange={() => handleFacilityChange(facility)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor={`facility-${facility}`}
                      className="ml-2 block text-sm text-gray-700 font-zen-kaku-gothic"
                    >
                      {facility}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* 価格情報 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
                価格情報
              </h2>
              <div className="space-y-4">
                {formData.prices?.map((price, index) => (
                  <div
                    key={index}
                    className="flex flex-col md:flex-row md:items-center gap-2"
                  >
                    <div className="w-full md:w-1/2">
                      <label
                        htmlFor={`price-${index}`}
                        className="block text-sm font-medium text-gray-700 mb-1 font-zen-kaku-gothic"
                      >
                        {price.timeRange}
                      </label>
                    </div>
                    <div className="w-full md:w-1/2">
                      <div className="flex items-center">
                        <span className="text-gray-500 mr-2">¥</span>
                        <input
                          type="text"
                          id={`price-${index}`}
                          value={price.price.toLocaleString()}
                          onChange={(e) =>
                            handlePriceChange(index, e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 時間枠設定 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
                時間枠設定
              </h2>
              <p className="text-sm text-gray-600 mb-4 font-zen-kaku-gothic">
                {formData.category === "slow_room"
                  ? "スロールームは日付ごとの在庫管理となります。各日付の最大予約可能数を設定してください。"
                  : "各時間枠の予約可能数と価格を設定します。これにより、顧客が予約可能な時間帯と価格が決まります。"}
              </p>

              {formData.category === "slow_room" ? (
                // スロールーム日付ごとの在庫設定
                <SlowRoomInventoryCalendar
                  initialInventory={formData.dailyInventory}
                  onChange={(inventory) => {
                    setFormData({
                      ...formData,
                      dailyInventory: inventory,
                    });
                  }}
                />
              ) : formData.timeSlots && formData.timeSlots.length > 0 ? (
                // 通常の時間枠設定
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                        >
                          時間帯
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                        >
                          平日価格
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                        >
                          休日価格
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-zen-kaku-gothic"
                        >
                          最大予約数
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {formData.timeSlots.map((slot, index) => (
                        <tr key={index}>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {slot.time}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-gray-500 mr-2">¥</span>
                              <input
                                type="number"
                                className="w-24 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={
                                  slot.pricing && slot.pricing.weekday
                                    ? slot.pricing.weekday
                                    : ""
                                }
                                onChange={(e) =>
                                  handleTimeSlotPriceChange(
                                    index,
                                    "weekday",
                                    e.target.value
                                  )
                                }
                                placeholder="平日価格"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-gray-500 mr-2">¥</span>
                              <input
                                type="number"
                                className="w-24 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={
                                  slot.pricing && slot.pricing.weekend
                                    ? slot.pricing.weekend
                                    : ""
                                }
                                onChange={(e) =>
                                  handleTimeSlotPriceChange(
                                    index,
                                    "weekend",
                                    e.target.value
                                  )
                                }
                                placeholder="休日価格"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              min="1"
                              className="w-16 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              value={slot.maxReservations || 1}
                              onChange={(e) =>
                                handleTimeSlotMaxReservationsChange(
                                  index,
                                  e.target.value
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 italic text-sm">
                  時間枠が設定されていません。客室タイプを選択してください。
                </p>
              )}
            </div>

            {/* 送信ボタン */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => router.push("/admin/rooms")}
                className="px-4 py-2 bg-gray-100 rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-4 py-2 bg-[#AB9F8D] text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-[#9A8F7E] transition-colors ${
                  submitting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {submitting ? "保存中..." : "保存する"}
              </button>
            </div>
          </form>
        </div>
      </AdminLayout>
    </Layout>
  );
}
