"use client";

import { useState, useEffect, useCallback, useRef, TouchEvent } from "react";
import Image from "next/image";
import { InfoIcon, X, ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import DateTimeSelection from "../DateTimeSelection";
import PureSlowRoomSelection from "../PureSlowRoomSelection";
import { Room, RoomType, RoomCategory } from "@/types/room";

interface RoomInfoModalProps {
  room: Room | null;
  onClose: () => void;
}

function RoomInfoModal({ room, onClose }: RoomInfoModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  // 合并主图和附加图片
  const allImages = room ? 
    [room.imageUrl, ...(room.images || [])].filter(Boolean) : 
    [];
  
  // 在弹窗显示时禁用背景滚动
  useEffect(() => {
    // 保存原始的overflow样式
    const originalStyle = document.body.style.overflow;
    
    // 禁用滚动
    document.body.style.overflow = 'hidden';
    
    // 清理函数：恢复滚动
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);
  
  // 处理图片轮播
  const nextImage = useCallback(() => {
    setCurrentImageIndex((prev) => 
      prev === allImages.length - 1 ? 0 : prev + 1
    );
  }, [allImages.length]);
  
  const prevImage = useCallback(() => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? allImages.length - 1 : prev - 1
    );
  }, [allImages.length]);
  
  // 使用ref和useEffect添加事件监听器，而不是内联的onTouch属性
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider || allImages.length <= 1) return;
    
    let startX: number;
    
    const handleTouchStart = (e: Event) => {
      const touchEvent = e as unknown as TouchEvent;
      startX = touchEvent.touches[0].clientX;
    };
    
    const handleTouchMove = (e: Event) => {
      // 不在这里调用preventDefault，而是只阻止冒泡
      e.stopPropagation();
    };
    
    const handleTouchEnd = (e: Event) => {
      const touchEvent = e as unknown as TouchEvent;
      const endX = touchEvent.changedTouches[0].clientX;
      const diff = startX - endX;
      
      // 判断滑动方向和距离
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          // 向左滑动
          nextImage();
        } else {
          // 向右滑动
          prevImage();
        }
      }
    };
    
    // 添加带有options的事件监听器
    slider.addEventListener('touchstart', handleTouchStart, { passive: true });
    slider.addEventListener('touchmove', handleTouchMove, { passive: true });
    slider.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // 清理函数
    return () => {
      slider.removeEventListener('touchstart', handleTouchStart);
      slider.removeEventListener('touchmove', handleTouchMove);
      slider.removeEventListener('touchend', handleTouchEnd);
    };
  }, [allImages.length, nextImage, prevImage]);

  if (!room) return null;

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg p-4 max-w-2xl w-[95%] md:w-full mx-auto my-4 max-h-[90vh] overflow-y-auto overscroll-none"
        onClick={(e) => e.stopPropagation()} // 阻止点击内容区域关闭弹窗
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => {
          e.stopPropagation(); 
          // 允许内部滚动，但阻止背景滚动
        }}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="h-6 w-6 text-[#444444]" />
          </button>
        </div>
        <div className="px-2 sm:px-8">
          {/* 轮播图 */}
          <div 
            ref={sliderRef}
            className="relative w-full h-[180px] sm:h-[320px] mb-4 touch-pan-x select-none"
          >
            {allImages.length > 0 ? (
              <>
                <Image
                  src={allImages[currentImageIndex] || "/images/room-placeholder.jpg"}
                  alt={`${room.roomType} - 画像 ${currentImageIndex + 1}`}
                  fill
                  className="object-contain rounded-lg"
                />
                
                {/* 只有多张图片时显示轮播控制 */}
                {allImages.length > 1 && (
                  <>
                    {/* 轮播指示器 */}
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-2">
                      {allImages.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-2 h-2 rounded-full ${
                            index === currentImageIndex
                              ? "bg-white"
                              : "bg-white/50"
                          }`}
                          aria-label={`画像 ${index + 1} へ移動`}
                        />
                      ))}
                    </div>
                    
                    {/* 左右箭头 - 只在PC端显示 */}
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 rounded-full p-1 hover:bg-black/50 transition-colors hidden md:block"
                      aria-label="前の画像"
                    >
                      <ChevronLeft className="h-6 w-6 text-white" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 rounded-full p-1 hover:bg-black/50 transition-colors hidden md:block"
                      aria-label="次の画像"
                    >
                      <ChevronRight className="h-6 w-6 text-white" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <Image
                src="/images/room-placeholder.jpg"
                alt={room.roomType}
                fill
                className="object-contain rounded-lg"
              />
            )}
          </div>
          <table className="w-full border-collapse mb-8">
            <tbody>
              <tr className="border-b border-[rgba(68,68,68,0.2)]">
                <td className="py-3 md:py-4 w-[30%] text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic">
                  利用時間
                </td>
                <td className="py-3 md:py-4 w-[70%] text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic">
                  {room.duration}
                </td>
              </tr>
              <tr className="border-b border-[rgba(68,68,68,0.2)]">
                <td className="py-3 md:py-4 text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic">
                  価格
                </td>
                <td className="py-3 md:py-4 w-[70%] text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic">
                  <div className="space-y-2">
                    {room.prices.map((priceInfo, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{priceInfo.timeRange}</span>
                        <span className="font-medium">
                          {priceInfo.displayPrice}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
              <tr className="border-b border-[rgba(68,68,68,0.2)]">
                <td className="py-3 md:py-4 text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic">
                  延長料金
                </td>
                <td className="py-3 md:py-4 text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic">
                  {room.extension}
                </td>
              </tr>
              <tr className="border-b border-[rgba(68,68,68,0.2)]">
                <td className="py-3 md:py-4 text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic">
                  説明
                </td>
                <td className="py-3 md:py-4 text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic">
                  {room.description}
                </td>
              </tr>
              {room.facilities && room.facilities.length > 0 && (
                <tr className="border-b border-[rgba(68,68,68,0.2)]">
                  <td className="py-3 md:py-4 text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic">
                    設備
                  </td>
                  <td className="py-3 md:py-4 text-[13px] md:text-base text-[#444444] font-zen-kaku-gothic">
                    {room.facilities.join("、")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex justify-center mb-2">
            <button
              onClick={onClose}
              className="px-8 md:px-12 py-2 md:py-3 bg-[#444444] text-white rounded-md hover:bg-[#333333] transition-colors font-zen-kaku-gothic text-[14px] md:text-base"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function RoomSelection() {
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | "">("");
  const [selectedTab, setSelectedTab] = useState<RoomCategory | "">("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedRoomInfo, setSelectedRoomInfo] = useState<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  // 在组件挂载时获取所有房间信息
  useEffect(() => {
    setIsMounted(true);

    const fetchRooms = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/rooms");

        if (!response.ok) {
          throw new Error("客室情報の取得に失敗しました");
        }

        const data = await response.json();

        // 确保接收到的是有效的房间数组并按displayOrder排序
        if (data.rooms && Array.isArray(data.rooms)) {
          const activeRooms = data.rooms
            .filter((room: Room) => room.isActive)
            .sort(
              (a: Room, b: Room) =>
                (a.displayOrder || 0) - (b.displayOrder || 0)
            );

          setRooms(activeRooms);
        } else {
          throw new Error("無効な客室データを受信しました");
        }
      } catch (err) {
        console.error("客室データの取得エラー:", err);
        setError(
          err instanceof Error
            ? err.message
            : "客室データの取得中にエラーが発生しました"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();

    // 添加隐藏滚动条的CSS
    if (typeof document !== "undefined") {
      if (!document.getElementById("hide-scrollbar-style")) {
        const style = document.createElement("style");
        style.id = "hide-scrollbar-style";
        style.innerHTML = `
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  // 滚动选中的tab到视图中央
  useEffect(() => {
    if (selectedTab && tabScrollRef.current) {
      const tabContainer = tabScrollRef.current;
      const selectedTabElement = tabContainer.querySelector(
        `[data-tab-id="${selectedTab}"]`
      );

      if (selectedTabElement) {
        const containerWidth = tabContainer.offsetWidth;
        const tabWidth = selectedTabElement.clientWidth;
        const tabLeft = (selectedTabElement as HTMLElement).offsetLeft;

        // 计算滚动位置，使选中的tab居中
        const scrollPosition = tabLeft - containerWidth / 2 + tabWidth / 2;

        // 平滑滚动到计算出的位置
        tabContainer.scrollTo({
          left: Math.max(0, scrollPosition),
          behavior: "smooth",
        });
      }
    }
  }, [selectedTab]);

  const handleInfoClick = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const roomInfo = rooms.find((room) => room.id === roomId) || null;
    setSelectedRoomInfo(roomInfo);
    setShowInfoModal(true);
  };

  // 根据当前选中的tab筛选要显示的房间
  const filteredRooms = rooms.filter((room) => {
    if (!selectedTab) return false;
    return room.category === selectedTab;
  });

  // 处理房间选择
  const handleRoomSelection = useCallback(
    (roomId: string) => {
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        // 设置选中房间ID
        setSelectedRoomId(roomId);

        // 不再使用空字符串和setTimeout的方式重置组件
        // 只在房间类型发生变化时才设置新的房间类型
        if (selectedRoomType !== room.roomType) {
          setSelectedRoomType(room.roomType);
        }
      }
    },
    [rooms, selectedRoomType]
  );

  // 处理选项卡切换
  const handleTabChange = useCallback((tabId: RoomCategory | "") => {
    setSelectedTab(tabId);
    setSelectedRoomId(""); // 当切换选项卡时，清除选中的房间
    setSelectedRoomType(""); // 清除选中的房间类型，这将隐藏DateTimeSelection组件
  }, []);

  // 根据当前选中的tab调整网格布局
  const getGridColsClass = () => {
    if (!selectedTab) return "";

    const roomCount = filteredRooms.length;

    // 根据房间数量和屏幕尺寸调整网格布局
    if (roomCount <= 2) {
      return "grid-cols-1 md:grid-cols-2 lg:grid-cols-2";
    } else if (roomCount <= 4) {
      return "grid-cols-2 md:grid-cols-2 lg:grid-cols-4";
    } else {
      return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    }
  };

  // 获取所有可用的房间分类
  const roomCategories = Array.from(
    new Set(rooms.map((room) => room.category))
  ).filter(Boolean) as RoomCategory[];

  // 分类标签列表
  const categoryLabels: Record<RoomCategory, string> = {
    private_sauna: "プライベートサウナ",
    sauna_suite: "サウナスイート",
    slow_room: "スロールーム",
  };

  // 检查是否为slow_room房间类型
  const isSlowRoom = (roomType: RoomType): boolean => {
    return roomType === "slow_room";
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-12">
        <div className="border-b border-[rgba(68,68,68,0.2)] pb-0 md:pb-4">
          <div className="pb-[8px] md:pb-0">
            <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
              部屋を選んでください
            </h1>
          </div>
        </div>
        <div className="flex justify-center py-8">
          <p className="text-gray-600 font-zen-kaku-gothic">
            客室情報を読み込み中...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 md:space-y-12">
        <div className="border-b border-[rgba(68,68,68,0.2)] pb-0 md:pb-4">
          <div className="pb-[8px] md:pb-0">
            <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
              部屋を選んでください
            </h1>
          </div>
        </div>
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-red-700 font-zen-kaku-gothic">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-indigo-600 underline text-sm font-zen-kaku-gothic"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-12">
      <div className="border-b border-[rgba(68,68,68,0.2)] pb-0 md:pb-4">
        <div className="pb-[8px] md:pb-0">
          <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
            部屋を選んでください
          </h1>
        </div>
      </div>

      {/* Tab切换 */}
      <div className="relative w-full">
        <div
          ref={tabScrollRef}
          className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 pb-2 md:pb-0 w-full"
        >
          {roomCategories.map((category) => (
            <button
              key={category}
              data-tab-id={category}
              onClick={() => handleTabChange(category)}
              className={`w-full py-1.5 md:py-3 px-4 md:px-6 rounded-full border border-[#444444] font-zen-kaku-gothic text-[12px] md:text-base font-bold md:font-normal tracking-[0.06em] transition-colors text-center ${
                selectedTab === category
                  ? "bg-[#F0EAE4] text-[#444444]"
                  : "bg-white text-[#444444] hover:bg-gray-50"
              }`}
            >
              {categoryLabels[category] || category}
            </button>
          ))}
        </div>
      </div>

      {/* 房间选择按钮 */}
      {selectedTab && (
        <div className={`grid ${getGridColsClass()} gap-3 md:gap-4`}>
          {filteredRooms.map((room) => (
            <button
              key={room.id}
              className={`flex items-center border rounded-md overflow-hidden transition-colors py-2 ${
                selectedRoomId === room.id
                  ? "border-[#444444] bg-[#F0EAE4]"
                  : "border-[#BBBBBB] bg-white hover:bg-gray-50"
              }`}
              onClick={() => handleRoomSelection(room.id)}
            >
              <div className="relative h-10 w-12 md:w-16 flex-shrink-0 ml-2 md:ml-3">
                <Image
                  src={
                    room.thumbnailUrl ||
                    "/images/room-thumbnail-placeholder.jpg"
                  }
                  alt={room.roomType}
                  fill
                  className="object-cover rounded"
                  sizes="(max-width: 768px) 48px, 64px"
                />
              </div>
              <div className="flex-grow px-2 md:px-3 text-left truncate">
                <span className="font-zen-kaku-gothic text-[13px] md:text-base font-bold tracking-[0.06em] text-[#444444]">
                  {room.roomType.replace(/_/g, ' ')}
                </span>
              </div>
              <div
                className="p-1.5 mr-2 rounded-full hover:bg-gray-100"
                onClick={(e) => handleInfoClick(room.id, e)}
              >
                <InfoIcon className="h-4 w-4 text-[#444444]" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 日期时间选择组件 - 根据房间类型显示不同的组件 */}
      {selectedRoomType &&
        (selectedTab === "slow_room" && isSlowRoom(selectedRoomType) ? (
          <PureSlowRoomSelection selectedRoomType={selectedRoomType} />
        ) : (
          <DateTimeSelection selectedRoomType={selectedRoomType} />
        ))}

      {isMounted && showInfoModal && (
        <RoomInfoModal
          room={selectedRoomInfo}
          onClose={() => setShowInfoModal(false)}
        />
      )}
    </div>
  );
}
