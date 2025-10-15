"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import DateTimeSelection from "../DateTimeSelection";
import PureSlowRoomSelection from "../PureSlowRoomSelection";
import { RoomType, RoomCategory } from "@/types/room";

type DisplayRoom = {
  id: string;
  roomType: RoomType;
  category: RoomCategory;
  title: string;
  leadLines: string[];
  detailLines: string[];
  thumbnailUrl: string;
};

type ApiRoom = {
  roomType: RoomType;
  imageUrl?: string | null;
  images?: (string | null)[] | null;
};

const categoryDetails: Record<
  RoomCategory,
  { title: string; description: string }
> = {
  sauna_suite: {
    title: "サウナスイート客室",
    description:
      "心と体をゆるめて、ゆっくりと贅沢なひとときを過ごしたいときに",
  },
  private_sauna: {
    title: "プライベートサウナ",
    description: "気分に合わせて、サウナを気軽に楽しみたい方へ",
  },
  slow_room: {
    title: "スロールーム客室",
    description:
      "シアターの光、レコードの音に包まれて、２人だけのホテルステイを満喫したいときに",
  },
};

const roomCategories: RoomCategory[] = [
  "sauna_suite",
  "private_sauna",
  "slow_room",
];

const ROOM_DATA: DisplayRoom[] = [
  {
    id: "room_sauna_suite",
    roomType: "sauna_suite",
    category: "sauna_suite",
    title: "sauna suite",
    leadLines: [
      "サウナ・ベッド・シアター・レコードを備え、",
      "開放的なバスエリアとバルコニーで、",
      "心と体を解き放つ極上の体験。",
    ],
    detailLines: [
      "定員：1~3名",
      "料金：29,800円～（180min）",
      "面積：45㎡",
      "サウナ(2名用)/バスタブ/製氷機/ダブルベッド",
      "ルームシアター/レコード/バルコニー/トイレ",
    ],
    thumbnailUrl: "/images/suite.jpeg",
  },
  {
    id: "room_tototo",
    roomType: "tototo",
    category: "private_sauna",
    title: "tototo",
    leadLines: ["ゆとりある空間で、贅沢に、上質な時間を過ごす"],
    detailLines: [
      "定員：1~4名",
      "料金：16,800円～（90min）",
      "面積：32㎡",
      "15~17℃の水風呂と38℃の温風呂が両方ついています",
    ],
    thumbnailUrl: "/images/tototo.jpeg",
  },
  {
    id: "room_toron",
    roomType: "toron",
    category: "private_sauna",
    title: "toron",
    leadLines: ["畳のととのいスペースで、心までゆるむひととき。"],
    detailLines: [
      "定員：1~3名",
      "料金：11,800円～（90min）",
      "面積：18㎡",
      "15~17℃の水風呂",
    ],
    thumbnailUrl: "/images/toron.jpeg",
  },
  {
    id: "room_zabuun",
    roomType: "zabuun",
    category: "private_sauna",
    title: "zabuun",
    leadLines: ["水のゆらぎと静けさに包まれ、ほどけていく。"],
    detailLines: [
      "定員：1~2名",
      "料金：10,800円～（90min）",
      "面積：17㎡",
      "15~17℃の水風呂",
    ],
    thumbnailUrl: "/images/zabuun.jpeg",
  },
  {
    id: "room_fuuu",
    roomType: "fuuu",
    category: "private_sauna",
    title: "fuuu",
    leadLines: ["静かに自分と向き合う、ととのいの時間。"],
    detailLines: [
      "定員：1~2名",
      "料金：9,980円～（90min）",
      "面積：15㎡",
      "15~17℃の水風呂",
    ],
    thumbnailUrl: "/images/fuuu.jpeg",
  },
  {
    id: "room_slow",
    roomType: "slow_room",
    category: "slow_room",
    title: "slow room",
    leadLines: [
      "レコードの音､ゆるやかに流れる映像、",
      "心地よい余韻に浸る､大人のためのシアター客室。",
    ],
    detailLines: [
      "定員：1~2名",
      "料金：6,900円～（120min～）",
      "面積：17㎡",
      "ルームシアター/レコード/ダブルベッド",
      "シャワー/トイレ",
    ],
    thumbnailUrl: "/images/slow-room.jpeg",
  },
];

const isSlowRoom = (roomType: RoomType): boolean => roomType === "slow_room";

export default function RoomSelection() {
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | "">("");
  const [selectedTab, setSelectedTab] = useState<RoomCategory>("sauna_suite");
  const dateTimeTitleRef = useRef<HTMLDivElement>(null);
  const [roomImages, setRoomImages] =
    useState<Partial<Record<RoomType, string[]>>>({});
  const [activeImageIndex, setActiveImageIndex] = useState<Record<string, number>>(
    {}
  );
  const touchStartXRef = useRef<Record<string, number>>({});
  const swipePreventRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const fetchRoomImages = async () => {
      try {
        const response = await fetch("/api/rooms");
        if (!response.ok) {
          throw new Error(`Failed to fetch rooms: ${response.status}`);
        }

        const data = await response.json();
        if (!data?.rooms || !Array.isArray(data.rooms)) {
          return;
        }

        const imagesMap: Partial<Record<RoomType, string[]>> = {};
        data.rooms.forEach((room: ApiRoom) => {
          if (!room?.roomType) return;

          const candidateSources = [
            room.imageUrl,
            ...(room.images ?? []),
          ];

          const uniqueSources = candidateSources.filter(
            (src, index): src is string =>
              Boolean(src) && candidateSources.indexOf(src) === index
          );

          if (uniqueSources.length > 0) {
            imagesMap[room.roomType] = uniqueSources;
          }
        });

        setRoomImages(imagesMap);
      } catch (error) {
        console.error("房间图片获取失败:", error);
      }
    };

    fetchRoomImages();
  }, []);

  const filteredRooms = ROOM_DATA.filter(
    (room) => room.category === selectedTab
  );

  const handleRoomSelection = useCallback(
    (roomId: string) => {
      const room = ROOM_DATA.find((r) => r.id === roomId);
      if (!room) return;

      setSelectedRoomId(roomId);

      if (selectedRoomType !== room.roomType) {
        setSelectedRoomType(room.roomType);
      }

      setTimeout(() => {
        dateTimeTitleRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 200);
    },
    [selectedRoomType]
  );

  const handleTabChange = useCallback((tabId: RoomCategory) => {
    setSelectedTab(tabId);
    setSelectedRoomId("");
    setSelectedRoomType("");
  }, []);

  const handleNextImage = useCallback((roomId: string, total: number) => {
    if (total <= 1) return;
    setActiveImageIndex((prev) => {
      const current = prev[roomId] ?? 0;
      const next = (current + 1) % total;
      return { ...prev, [roomId]: next };
    });
  }, []);

  const handlePrevImage = useCallback((roomId: string, total: number) => {
    if (total <= 1) return;
    setActiveImageIndex((prev) => {
      const current = prev[roomId] ?? 0;
      const previous = (current - 1 + total) % total;
      return { ...prev, [roomId]: previous };
    });
  }, []);

  const handleDotClick = useCallback((roomId: string, index: number) => {
    setActiveImageIndex((prev) => ({ ...prev, [roomId]: index }));
  }, []);

  const handleTouchStart = useCallback((roomId: string, clientX: number) => {
    swipePreventRef.current[roomId] = false;
    touchStartXRef.current[roomId] = clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (roomId: string, clientX: number, total: number) => {
      if (total <= 1) return;
      const startX = touchStartXRef.current[roomId];
      if (startX === undefined) return;
      delete touchStartXRef.current[roomId];

      const diff = startX - clientX;
      if (Math.abs(diff) > 50) {
        swipePreventRef.current[roomId] = true;
        if (diff > 0) {
          handleNextImage(roomId, total);
        } else {
          handlePrevImage(roomId, total);
        }
      }
    },
    [handleNextImage, handlePrevImage]
  );

  return (
    <div className="space-y-6 md:space-y-10">
      <div className="border-b border-[rgba(68,68,68,0.2)] pb-0 md:pb-4">
        <div className="pb-[8px] md:pb-0">
          <h1 className="text-base md:text-2xl font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
            部屋タイプを選んでください
          </h1>
        </div>
      </div>

      {/* 房间分类Tab切换 */}
      <div className="relative w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 pb-2 md:pb-0 w-full">
          {roomCategories.map((category) => (
            <button
              key={category}
              onClick={() => handleTabChange(category)}
              className={`w-full px-4 md:px-6 py-3 md:py-4 rounded-[16px] border border-[#444444] font-zen-kaku-gothic text-center transition-colors flex flex-col justify-center items-center gap-1 ${
                selectedTab === category
                  ? "bg-[#F0EAE4] text-[#444444]"
                  : "bg-white text-[#444444] hover:bg-gray-50"
              }`}
            >
              <span className="text-sm md:text-base font-bold tracking-[0.06em]">
                {categoryDetails[category].title}
              </span>
              <span className="text-xs md:text-sm leading-snug tracking-[0.03em]">
                {categoryDetails[category].description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 房间类型选择卡片 */}
      <div className="flex flex-col gap-3 md:gap-5">
        {filteredRooms.map((room) => {
          const isSelected = selectedRoomId === room.id;
          const imageList = roomImages[room.roomType] ?? [];
          const totalImages = imageList.length;
          const rawIndex = activeImageIndex[room.id] ?? 0;
          const currentIndex =
            totalImages > 0
              ? ((rawIndex % totalImages) + totalImages) % totalImages
              : 0;
          const currentImage =
            totalImages > 0 ? imageList[currentIndex] ?? null : null;
          const showControls = totalImages > 1;

          return (
            <div
              key={room.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (swipePreventRef.current[room.id]) {
                  swipePreventRef.current[room.id] = false;
                  return;
                }
                handleRoomSelection(room.id);
              }}
              className={`relative flex flex-col md:flex-row md:items-start gap-3 md:gap-6 rounded-[4px] border cursor-pointer overflow-hidden transition-all outline-none ${
                isSelected
                  ? "border-[#444444] border-2 bg-[#F9F6F2] shadow-md"
                  : "bg-[#FFF] border-[#BBB]"
              }`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleRoomSelection(room.id);
                }
              }}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 z-10 bg-white rounded-full p-1.5 shadow-md border-2 border-[#444444]">
                  <Check className="h-4 w-4 text-[#444444]" strokeWidth={2.5} />
                </div>
              )}

              <div
                className="relative aspect-[3/2] w-full overflow-hidden md:w-[360px] md:flex-shrink-0 md:self-stretch lg:w-[380px]"
                onTouchStart={(event) => {
                  event.stopPropagation();
                  if (!showControls) return;
                  if (event.touches && event.touches[0]) {
                    handleTouchStart(room.id, event.touches[0].clientX);
                  }
                }}
                onTouchMove={(event) => {
                  event.stopPropagation();
                }}
                onTouchEnd={(event) => {
                  event.stopPropagation();
                  if (!showControls) return;
                  if (event.changedTouches && event.changedTouches[0]) {
                    handleTouchEnd(
                      room.id,
                      event.changedTouches[0].clientX,
                      totalImages
                    );
                  }
                }}
              >
                {currentImage ? (
                  <Image
                    key={currentImage}
                    src={currentImage}
                    alt={room.title}
                    fill
                    sizes="(min-width: 1024px) 40vw, (min-width: 768px) 45vw, 100vw"
                    className="object-cover transition-transform duration-300"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#EFEDEA] text-xs text-[#777] md:text-sm">
                    写真準備中
                  </div>
                )}
                {showControls && currentImage && (
                  <>
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 md:flex"
                      onClick={(event) => {
                        event.stopPropagation();
                        handlePrevImage(room.id, totalImages);
                      }}
                      aria-label="前の画像を見る"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 md:flex"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNextImage(room.id, totalImages);
                      }}
                      aria-label="次の画像を見る"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
                      {imageList.map((_, index) => (
                        <button
                          key={`${room.id}-dot-${index}`}
                          type="button"
                          className={`h-2 w-2 rounded-full transition ${
                            index === currentIndex
                              ? "bg-white"
                              : "bg-white/50 hover:bg-white/80"
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDotClick(room.id, index);
                          }}
                          aria-label={`画像${index + 1}を表示`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between p-4 md:p-6 text-[#444444] font-zen-kaku-gothic">
                <div className="space-y-1.5 md:space-y-3">
                  <span className="text-lg md:text-xl font-bold tracking-[0.06em]">
                    {room.title}
                  </span>
                  <div className="space-y-1 text-sm md:text-base tracking-[0.03em] leading-relaxed">
                    {room.leadLines.map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                  <div className="space-y-1 text-xs md:text-sm tracking-[0.03em] leading-relaxed">
                    {room.detailLines.map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 日期时间选择组件 - 根据房间类型显示不同的组件 */}
      {selectedRoomType &&
        (selectedTab === "slow_room" && isSlowRoom(selectedRoomType) ? (
          <PureSlowRoomSelection selectedRoomType={selectedRoomType} />
        ) : (
          <div ref={dateTimeTitleRef}>
            <DateTimeSelection selectedRoomType={selectedRoomType} />
          </div>
        ))}
    </div>
  );
}
