"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/utils/firebase";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import Image from "next/image";
import {
  Reservation,
  RoomCard,
  RoomAssignment,
  RoomCardStatus,
} from "@/types/reservation";
import { Timestamp } from "firebase/firestore";
import { toDate, formatToJapaneseDate } from "@/utils/date";

// 扩展Reservation接口以包含所需的额外属性
interface ExtendedReservation extends Reservation {
  hasRoomAssignment?: boolean;
  hasSlowRoomAssignment?: boolean;
  slowRoomTime?: string;
  cardEmailSent?: boolean; // 添加卡片邮件发送状态
}

// 删除这两个接口的定义，因为它们与导入的接口冲突

export default function CardIssueManagementPage() {
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // 修改为使用对象状态
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });

  // 状态管理
  const [reservations, setReservations] = useState<ExtendedReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [selectedReservation, setSelectedReservation] =
    useState<ExtendedReservation | null>(null);
  const [availableRooms, setAvailableRooms] = useState<{
    [key: string]: boolean;
  }>({});
  const [availableSlowRooms, setAvailableSlowRooms] = useState<{
    [key: string]: boolean;
  }>({});
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedSlowRoom, setSelectedSlowRoom] = useState<string | null>(null);
  const [generatedCard, setGeneratedCard] = useState<RoomCard | null>(null);
  const [generatedSlowRoomCard, setGeneratedSlowRoomCard] =
    useState<RoomCard | null>(null);
  const [issuingCard, setIssuingCard] = useState(false);
  const [error1, setError1] = useState<string | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSetPlanSection, setShowSetPlanSection] = useState(false);
  // 添加分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showReservationList, setShowReservationList] = useState(true);
  const [loadingRoomAssignments, setLoadingRoomAssignments] = useState(false);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);

  // 房间类型映射
  const roomTypeMapping: { [key: string]: string } = {
    tototo: "TOTOTO",
    fuuu: "FUUU",
    zabuun: "ZABUUN",
    toron: "TORON",
    sauna_suite: "サウナスイート",
    slow_room: "スロールーム",
  };

  // 房间ID映射
  const roomIdMapping: { [key: string]: string } = {
    tototo: "room_101",
    fuuu: "room_102",
    zabuun: "room_103",
    toron: "room_104",
    sauna_suite: "room_201",
    slow_room_1: "room_202",
    slow_room_2: "room_203",
    slow_room_3: "room_204",
    slow_room_4: "room_205",
    slow_room_5: "room_206",
    slow_room_6: "room_301",
    slow_room_7: "room_302",
    slow_room_8: "room_303",
    slow_room_9: "room_304",
    slow_room_10: "room_305",
  };

  // 房间号对应房间类型
  const roomNumberToType: { [key: string]: string } = {
    room_101: "tototo",
    room_102: "fuuu",
    room_103: "zabuun",
    room_104: "toron",
    room_201: "sauna_suite",
    room_202: "slow_room",
    room_203: "slow_room",
    room_204: "slow_room",
    room_205: "slow_room",
    room_206: "slow_room",
    room_301: "slow_room",
    room_302: "slow_room",
    room_303: "slow_room",
    room_304: "slow_room",
    room_305: "slow_room",
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

  // 加载预约
  const loadReservations = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingReservations(true);
      setAssignmentsLoaded(false); // 重置分配状态加载标志
      setError1(null);

      const idToken = await user.getIdToken();
      let url = "/api/admin/reservations?status=paid";

      if (searchEmail) {
        url += `&email=${encodeURIComponent(searchEmail)}`;
      }

      if (searchDate) {
        url += `&date=${encodeURIComponent(searchDate)}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("予約データの取得に失敗しました");
      }

      const data = await response.json();

      // 保存原始预约数据，初始化房间分配状态为未知
      const reservationsData = (data.reservations || []).map((reservation: ExtendedReservation) => ({
        ...reservation,
        hasRoomAssignment: undefined, // 初始状态为未知
        hasSlowRoomAssignment: undefined,
      }));
      
      setReservations(reservationsData);
      setCurrentPage(1); // 重置到第一页

    } catch (error) {
      console.error("予約の読み込みエラー:", error);
      setError1(
        error instanceof Error ? error.message : "予約の読み込みに失敗しました"
      );
    } finally {
      setLoadingReservations(false);
    }
  }, [user, searchEmail, searchDate]);

  // 为当前显示页面的预约加载房间分配状态 - 如果尚未加载过
  const loadRoomAssignmentsForCurrentPage = useCallback(async () => {
    if (!user || reservations.length === 0 || loadingReservations || loadingRoomAssignments || !showReservationList) return;
    
    // 获取当前页面的预约
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, reservations.length);
    const currentPageReservations = reservations.slice(startIndex, endIndex);
    
    // 检查当前页面的预约是否已加载过房间分配状态
    const needsLoading = currentPageReservations.some(
      res => res.hasRoomAssignment === undefined
    );
    
    if (!needsLoading) {
      return; // 如果所有预约都已加载过房间分配状态，则跳过
    }
    
    try {
      setLoadingRoomAssignments(true);
      
      // 收集需要查询的预约ID
      const reservationIds = currentPageReservations
        .filter(res => res.hasRoomAssignment === undefined)
        .map(res => res.id);
      
      if (reservationIds.length === 0) return;
      
      const idToken = await user.getIdToken();
      
      // 定义响应类型
      type AssignmentResponse = { id: string; data: any } | { id: string; error: any };
      
      // 批量查询API - 一次性获取多个预约的分配状态
      const responses: AssignmentResponse[] = await Promise.all(
        reservationIds.map(id => 
          fetch(`/api/admin/room-assignments?reservationId=${id}`, {
            headers: { Authorization: `Bearer ${idToken}` }
          })
            .then(res => res.json().then(data => ({ id, data } as const)))
            .catch(err => ({ id, error: err } as const))
        )
      );
      
      // 处理响应并更新状态
      const newReservations = [...reservations];
      
      responses.forEach(response => {
        if ('error' in response) {
          console.error(`获取预约 ${response.id} 的房间分配状态失败:`, response.error);
          return;
        }
        
        const reservationIndex = newReservations.findIndex(r => r.id === response.id);
        if (reservationIndex === -1) return;
        
        const assignmentData = response.data;
        
        // 检查是否有主房间分配
        const hasMainRoomAssignment = assignmentData.assignments &&
          assignmentData.assignments.some(
            (a: any) => a.roomType === newReservations[reservationIndex].roomType
          );
        
        // 检查是否有Slow Room分配（套餐）
        const hasSlowRoomAssignment = newReservations[reservationIndex].slowRoomAsSetPlan &&
          assignmentData.assignments &&
          assignmentData.assignments.some(
            (a: any) => a.roomType === "slow_room"
          );
        
        // 检查是否已发送卡片邮件
        const cardEmailSent = assignmentData.reservation?.cardEmailSent === true;
        
        newReservations[reservationIndex] = {
          ...newReservations[reservationIndex],
          hasRoomAssignment: hasMainRoomAssignment,
          hasSlowRoomAssignment: hasSlowRoomAssignment,
          cardEmailSent: cardEmailSent,
        };
      });
      
      setReservations(newReservations);
      setAssignmentsLoaded(true);
      
    } catch (error) {
      console.error("批量获取房间分配状态时出错:", error);
    } finally {
      setLoadingRoomAssignments(false);
    }
  }, [user, reservations, currentPage, itemsPerPage, loadingReservations, loadingRoomAssignments, showReservationList]);

  // 监听当前页面变化，加载对应页面的房间分配状态，但仅当显示预约列表且用户没有正在执行其他操作时执行
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (showReservationList && !loadingReservations && !loadingRoomAssignments) {
      // 添加延迟，避免频繁调用
      timeoutId = setTimeout(() => {
        loadRoomAssignmentsForCurrentPage();
      }, 300);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentPage, showReservationList, loadingReservations, loadingRoomAssignments, loadRoomAssignmentsForCurrentPage]);

  // 选择预约后检查房间可用性
  const checkRoomAvailability = async (reservation: ExtendedReservation) => {
    if (!user || !reservation) return;

    try {
      setLoadingRooms(true);
      setSelectedReservation(reservation);
      setSelectedRoom(null);
      setSelectedSlowRoom(null);
      setGeneratedCard(null);
      setGeneratedSlowRoomCard(null);
      setError1(null);
      // 邮件状态重置 - 确保使用预约的实际状态
      setEmailSent(reservation.cardEmailSent === true);
      // 隐藏预约列表，转到房间分配视图
      setShowReservationList(false);

      const idToken = await user.getIdToken();

      // 如果已经分配了房间，获取分配信息和卡片信息
      if (reservation.hasRoomAssignment) {
        // 获取房间分配信息
        const roomAssignmentsResponse = await fetch(
          `/api/admin/room-assignments?reservationId=${reservation.id}`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );
        
        if (!roomAssignmentsResponse.ok) {
          throw new Error("部屋割り当て情報の取得に失敗しました");
        }
        
        const roomAssignmentsData = await roomAssignmentsResponse.json();
        
        // 获取与此预约相关的所有卡片
        const cardsResponse = await fetch(
          `/api/admin/cards?reservationId=${reservation.id}`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );
        
        if (!cardsResponse.ok) {
          throw new Error("カード情報の取得に失敗しました");
        }
        
        const cardsData = await cardsResponse.json();
        
        if (cardsData.cards && cardsData.cards.length > 0) {
          // 主房间卡片
          const mainCard = cardsData.cards.find((card: any) => 
            roomNumberToType[card.physicalRoomId] === reservation.roomType
          );
          
          if (mainCard) {
            setGeneratedCard(mainCard);
            setSelectedRoom(mainCard.physicalRoomId);
          }
          
          // 如果是套餐预约，查找slow room卡片
          if (reservation.slowRoomAsSetPlan) {
            const slowRoomCard = cardsData.cards.find((card: any) => 
              roomNumberToType[card.physicalRoomId] === "slow_room"
            );
            
            if (slowRoomCard) {
              setGeneratedSlowRoomCard(slowRoomCard);
              setSelectedSlowRoom(slowRoomCard.physicalRoomId);
              setShowSetPlanSection(true);
            }
          }
        }
        
        // 隐藏可用房间选择，直接显示已分配的房间和卡片
        setAvailableRooms({});
        setAvailableSlowRooms({});
        
      } else {
        // 检查是否为套餐预约
        const isSetPlan = reservation.slowRoomAsSetPlan === true;
        setShowSetPlanSection(isSetPlan);

        // 获取主房间可用性
        const response = await fetch(
          `/api/admin/room-availability?reservationId=${reservation.id}`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("部屋の空き状況の取得に失敗しました");
        }

        const data = await response.json();

        // 主房间可用性 - 只保留与预约类型匹配的房间
        const filteredAvailableRooms: { [key: string]: boolean } = {};

        Object.entries(data.availableRooms || {}).forEach(
          ([roomId, isAvailable]) => {
            // 检查房间类型是否与预约类型匹配
            if (isRoomTypeMatch(roomId, reservation.roomType)) {
              filteredAvailableRooms[roomId] = isAvailable as boolean;
            }
          }
        );

        setAvailableRooms(filteredAvailableRooms);

        // 如果是套餐预约，获取Slow Room可用性
        if (isSetPlan) {
          const slowRoomResponse = await fetch(
            `/api/admin/slow-room-availability?reservationId=${reservation.id}`,
            {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            }
          );

          if (slowRoomResponse.ok) {
            const slowRoomData = await slowRoomResponse.json();

            // Slow Room可用性 - 只保留slow_room类型的房间
            const filteredSlowRooms: { [key: string]: boolean } = {};

            Object.entries(slowRoomData.availableRooms || {}).forEach(
              ([roomId, isAvailable]) => {
                // 检查是否为Slow Room
                if (roomNumberToType[roomId] === "slow_room") {
                  filteredSlowRooms[roomId] = isAvailable as boolean;
                }
              }
            );

            setAvailableSlowRooms(filteredSlowRooms);
          } else {
            console.error("Slow Room可用性获取失败");
            setAvailableSlowRooms({});
          }
        }
      }
    } catch (error) {
      console.error("部屋の空き状況チェックエラー:", error);
      setError1(
        error instanceof Error
          ? error.message
          : "部屋の空き状況の確認に失敗しました"
      );
    } finally {
      setLoadingRooms(false);
    }
  };

  // 处理房间选择
  const handleRoomSelection = (roomId: string) => {
    if (!generatedCard) {
      setSelectedRoom(roomId);
    }
  };

  // 处理Slow Room选择
  const handleSlowRoomSelection = (roomId: string) => {
    if (!generatedSlowRoomCard) {
      setSelectedSlowRoom(roomId);
    }
  };

  // 显示确认对话框
  const showConfirmationDialog = () => {
    if (selectedRoom) {
      // 如果是套餐且需要分配Slow Room但尚未选择，提示错误
      if (
        showSetPlanSection &&
        !selectedSlowRoom &&
        !selectedReservation?.hasSlowRoomAssignment
      ) {
        setError1("セットプランのSlow Roomも選択してください");
        return;
      }

      // 清除之前可能存在的错误信息
      setError1(null);
      setShowConfirmDialog(true);
    }
  };

  // 确认发行卡片
  const confirmIssueCard = () => {
    if (selectedRoom) {
      issueCard(selectedRoom);
      setShowConfirmDialog(false);
    }
  };

  // 取消发行卡片
  const cancelIssueCard = () => {
    setShowConfirmDialog(false);
  };

  // 发行房间卡
  const issueCard = async (roomId: string) => {
    if (!user || !selectedReservation) return;

    try {
      setIssuingCard(true);
      setError1(null);

      const idToken = await user.getIdToken();

      // 处理日期格式，确保有bookingDate参数
      const extractBookingDate = (timestamp: any) => {
        if (!timestamp) return null;

        // 如果是Firestore时间戳对象
        if (timestamp._seconds || timestamp.seconds) {
          const seconds = timestamp._seconds || timestamp.seconds;
          const date = new Date(seconds * 1000);
          return `${date.getFullYear()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
        }

        // 如果是Date对象或者其他可以直接转换的格式
        return new Date(timestamp).toISOString().split("T")[0];
      };

      // 从预约数据中提取日期（直接从bookingDate时间戳获取）
      let bookingDate = "";

      // 优先使用bookingDate字段
      if (selectedReservation.bookingDate) {
        const extractedDate = extractBookingDate(
          selectedReservation.bookingDate
        );
        if (extractedDate) bookingDate = extractedDate;
      } else if (selectedReservation.startDateTime) {
        // 如果没有bookingDate，尝试从startDateTime获取
        const extractedDate = extractBookingDate(
          selectedReservation.startDateTime
        );
        if (extractedDate) bookingDate = extractedDate;
      }

      // 如果上面的逻辑都未能获取到有效日期，使用当前日期作为默认值
      if (!bookingDate) {
        const today = new Date();
        bookingDate = `${today.getFullYear()}-${(today.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
      }

      // 1. 先发行主房间卡片
      const response = await fetch("/api/admin/issue-card", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationId: selectedReservation.id,
          physicalRoomId: roomId,
          // 必须包含bookingDate和reservationTime
          bookingDate: bookingDate,
          reservationTime:
            selectedReservation.displayTimeRange ||
            selectedReservation.reservationTime ||
            "10:00-12:00",
          // 可选但有助于处理的字段
          startDateTime: selectedReservation.startDateTime,
          endDateTime: selectedReservation.endDateTime,
          roomType: selectedReservation.roomType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "カード発行に失敗しました");
      }

      const cardData = await response.json();
      setGeneratedCard(cardData.card);

      // 2. 如果是套餐且选择了Slow Room，发行Slow Room卡片
      if (
        showSetPlanSection &&
        selectedSlowRoom &&
        selectedReservation.hasSlowRoomAssignment === false
      ) {
        try {
          // 为套餐中的slow room获取正确的时间范围
          let slowRoomTime = "";
          if (selectedReservation.displaySlowRoomTimeRange) {
            // 使用显示格式的时间范围
            slowRoomTime = selectedReservation.displaySlowRoomTimeRange;
          } else if (
            selectedReservation.slowRoomStartDateTime &&
            selectedReservation.slowRoomEndDateTime
          ) {
            // 从时间戳中提取时间范围
            const formatTimeFromTimestamp = (timestamp: any) => {
              if (!timestamp) return "";
              const date = new Date(
                (timestamp._seconds || timestamp.seconds) * 1000
              );
              return `${date.getHours().toString().padStart(2, "0")}:${date
                .getMinutes()
                .toString()
                .padStart(2, "0")}`;
            };

            const startTime = formatTimeFromTimestamp(
              selectedReservation.slowRoomStartDateTime
            );
            const endTime = formatTimeFromTimestamp(
              selectedReservation.slowRoomEndDateTime
            );
            slowRoomTime =
              startTime && endTime ? `${startTime}-${endTime}` : "10:00-12:00";
          } else {
            // 默认时间范围
            slowRoomTime = "10:00-12:00";
          }

          // 发行Slow Room卡片
          const slowRoomResponse = await fetch("/api/admin/issue-card", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reservationId: selectedReservation.id,
              physicalRoomId: selectedSlowRoom,
              // 必须包含bookingDate和reservationTime
              bookingDate: bookingDate,
              reservationTime: slowRoomTime,
              // 可选但有助于处理的字段
              slowRoomStartDateTime: selectedReservation.slowRoomStartDateTime,
              slowRoomEndDateTime: selectedReservation.slowRoomEndDateTime,
              roomType: "slow_room",
              slowRoomTime: slowRoomTime,
              isSetPlanSlowRoom: true, // 标记为套餐的Slow Room
            }),
          });

          if (!slowRoomResponse.ok) {
            const errorData = await slowRoomResponse.json();
            throw new Error(
              errorData.error || "スロールームカード発行に失敗しました"
            );
          }

          const slowRoomCardData = await slowRoomResponse.json();
          setGeneratedSlowRoomCard(slowRoomCardData.card);
        } catch (slowRoomError) {
          console.error("Slow Room卡片发行错误:", slowRoomError);
          setError1(
            slowRoomError instanceof Error
              ? slowRoomError.message
              : "スロールームカード発行に失敗しました"
          );
          // 即使Slow Room卡片发行失败，也保留主卡片
        }
      }
    } catch (error) {
      console.error("卡片发行错误:", error);
      setError1(
        error instanceof Error ? error.message : "カード発行に失敗しました"
      );
      setGeneratedCard(null);
      setGeneratedSlowRoomCard(null);
    } finally {
      setIssuingCard(false);
    }
  };

  // 发送邮件
  const sendCardEmail = async () => {
    if (!user || !selectedReservation || !generatedCard) return;

    try {
      setSendingEmail(true);
      setError1(null);

      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/send-card-email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationId: selectedReservation.id,
          cardId: generatedCard.id,
          userEmail: selectedReservation.userEmail,
          slowRoomCardId: generatedSlowRoomCard?.id, // 添加Slow Room卡片ID
        }),
      });

      if (!response.ok) {
        throw new Error("メール送信に失敗しました");
      }

      setEmailSent(true);
    } catch (error) {
      console.error("メール送信エラー:", error);
      setError1(
        error instanceof Error ? error.message : "メール送信に失敗しました"
      );
    } finally {
      setSendingEmail(false);
    }
  };

  // 格式化日期时间显示
  const formatDateTime = (dateStr?: string, timeStr?: string) => {
    // 优先使用新的字段格式：displayDate和displayTimeRange
    if (dateStr) {
      if (timeStr) {
        // 处理旧格式
        const timeDisplay = timeStr.includes("〜")
          ? timeStr.split("〜")[0]
          : timeStr;
        return `${dateStr} ${timeDisplay}`;
      }
      // 如果没有timeStr，只返回日期
      return dateStr;
    }
    return "日付未設定";
  };

  // 格式化Firestore Timestamp
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "未設定";

    try {
      // 检查带有_seconds和_nanoseconds的Firebase Timestamp对象
      if (typeof timestamp === "object" && (timestamp._seconds !== undefined)) {
        const seconds = timestamp._seconds;
        const date = new Date(seconds * 1000);
        
        // 格式化为日本日期时间格式: YYYY年MM月DD日 HH:MM
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${year}年${month}月${day}日 ${hours}:${minutes}`;
      }
      
      // 检查带有seconds和nanoseconds的Firebase Timestamp对象
      if (typeof timestamp === "object" && (timestamp.seconds !== undefined)) {
        const seconds = timestamp.seconds;
        const date = new Date(seconds * 1000);
        
        // 格式化为日本日期时间格式: YYYY年MM月DD日 HH:MM
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${year}年${month}月${day}日 ${hours}:${minutes}`;
      }
      
      // 检查是否有toDate方法（Firebase Timestamp）
      if (typeof timestamp === "object" && typeof timestamp.toDate === "function") {
        const date = timestamp.toDate();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${year}年${month}月${day}日 ${hours}:${minutes}`;
      }
      
      // 尝试使用toDate工具函数
      const date = toDate(timestamp);
      if (date && !isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${year}年${month}月${day}日 ${hours}:${minutes}`;
      }
      
      // 如果是字符串格式
      if (typeof timestamp === 'string') {
        // 已经是日本日期格式的情况
        const match = timestamp.match(/(\d+)年(\d+)月(\d+)日/);
        if (match) {
          return timestamp; // 已经是日本格式，直接返回
        }
        
        // 尝试将普通字符串日期转为日本格式
        const stringDate = new Date(timestamp);
        if (!isNaN(stringDate.getTime())) {
          const year = stringDate.getFullYear();
          const month = stringDate.getMonth() + 1;
          const day = stringDate.getDate();
          const hours = stringDate.getHours().toString().padStart(2, '0');
          const minutes = stringDate.getMinutes().toString().padStart(2, '0');
          
          return `${year}年${month}月${day}日 ${hours}:${minutes}`;
        }
      }

      // 处理displayDate和displayTimeRange的情况
      if (typeof timestamp === 'object' && timestamp.displayDate) {
        return timestamp.displayDate + (timestamp.displayTimeRange ? ` ${timestamp.displayTimeRange}` : '');
      }
      
      console.log("无法识别的时间戳格式:", JSON.stringify(timestamp));
      return "日付形式不明";
    } catch (error) {
      console.error("日期格式化错误:", error, timestamp);
      return "無効な日付";
    }
  };

  // 检查房间是否与预约类型匹配
  const isRoomTypeMatch = (roomId: string, reservationType: string) => {
    const roomType = roomNumberToType[roomId];

    // 对于slow_room类型，任何slow_room房间都匹配
    if (reservationType === "slow_room" && roomType === "slow_room") {
      return true;
    }

    // 对于其他类型，必须完全匹配
    return roomType === reservationType;
  };

  // 搜索条件更改时的处理
  const handleSearch = () => {
    loadReservations();
  };

  // 处理日期格式转换
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    setSearchDate(dateValue);
  };

  // 组件挂载后如果是管理员则加载预约
  useEffect(() => {
    if (adminState.isAdmin && adminState.checkComplete) {
      loadReservations();
    }
  }, [adminState.isAdmin, adminState.checkComplete, loadReservations]);

  // 计算分页数据
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentReservations = reservations.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(reservations.length / itemsPerPage);

  // 切换页面
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // 返回到预约列表
  const goBackToList = () => {
    setShowReservationList(true);
    loadReservations(); // 重新加载预约数据
  };

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
            onClick={() => router.push("/login?returnTo=/admin/card-issue")}
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
              お客様カード発行管理
            </h1>
          </div>

          {/* 検索フォーム */}
          {showReservationList && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h2 className="text-lg font-medium text-gray-800 mb-4 font-zen-kaku-gothic">
                予約検索
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 font-zen-kaku-gothic">
                    予約日
                  </label>
                  <input
                    type="date"
                    value={searchDate}
                    onChange={handleDateChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSearch}
                    disabled={loadingReservations}
                    className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-700"
                  >
                    {loadingReservations ? "検索中..." : "検索"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* エラーメッセージ */}
          {error1 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700 text-sm font-zen-kaku-gothic">
                {error1}
              </p>
            </div>
          )}

          {/* 予約リスト */}
          {showReservationList && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <h2 className="bg-gray-50 px-4 py-3 text-lg font-medium text-gray-800 font-zen-kaku-gothic border-b border-gray-200">
                予約一覧
              </h2>

              {loadingReservations ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500 font-zen-kaku-gothic">
                    データを読み込み中...
                  </p>
                </div>
              ) : reservations.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500 font-zen-kaku-gothic">
                    検索条件に一致する予約はありません
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          予約ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          お客様
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          予約日時
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          部屋タイプ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentReservations.map((reservation) => (
                        <tr
                          key={reservation.id}
                          className={
                            selectedReservation?.id === reservation.id
                              ? "bg-blue-50"
                              : ""
                          }
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {reservation.id.substring(0, 8)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {reservation.userFullName ? (
                              <div>
                                <div className="font-medium">
                                  {reservation.userFullName}
                                </div>
                                <div className="text-gray-500 text-xs mt-1">
                                  {reservation.userEmail}
                                </div>
                              </div>
                            ) : (
                              reservation.userEmail
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {reservation.displayDate &&
                            reservation.displayTimeRange
                              ? `${reservation.displayDate} ${reservation.displayTimeRange}`
                              : formatDateTime(
                                  reservation.reservationDate,
                                  reservation.reservationTime
                                )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {roomTypeMapping[reservation.roomType] ||
                              reservation.roomType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {reservation.hasRoomAssignment ? (
                              <div className="flex flex-col space-y-2">
                                <span className="text-green-600 font-medium">
                                  ✓ 割り当て済み
                                </span>
                                {!reservation.cardEmailSent && (
                                  <div>
                                    <span className="text-orange-500 text-xs block">
                                      メール未送信
                                    </span>
                                    <button
                                      onClick={() => checkRoomAvailability(reservation)}
                                      className="text-blue-600 hover:text-blue-900 text-xs mt-1"
                                    >
                                      メール送信へ
                                    </button>
                                  </div>
                                )}
                                {reservation.cardEmailSent && (
                                  <span className="text-green-500 text-xs">
                                    ✓ メール送信済み
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => checkRoomAvailability(reservation)}
                                disabled={loadingRooms}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                {loadingRooms &&
                                selectedReservation?.id === reservation.id
                                  ? "確認中..."
                                  : "部屋割り当て"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* 分页控件 */}
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
                            全 <span className="font-medium">{reservations.length}</span> 件中{" "}
                            <span className="font-medium">{indexOfFirstItem + 1}</span> から{" "}
                            <span className="font-medium">
                              {Math.min(indexOfLastItem, reservations.length)}
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
          )}

          {/* 部屋割り当て */}
          {selectedReservation && !showReservationList && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-6">
              <div className="flex justify-between items-center bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-800 font-zen-kaku-gothic">
                  部屋割り当て -{" "}
                  {roomTypeMapping[selectedReservation.roomType] ||
                    selectedReservation.roomType}
                  {selectedReservation.slowRoomAsSetPlan && " (セットプラン)"}
                </h2>
                <button
                  onClick={goBackToList}
                  className="px-3 py-1 bg-gray-500 text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-600"
                >
                  一覧に戻る
                </button>
              </div>

              {/* 预约详情 */}
              <div className="bg-blue-50 p-4 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">予約情報</h3>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">お客様:</span>{" "}
                      {selectedReservation.userFullName || selectedReservation.userEmail}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">予約ID:</span>{" "}
                      {selectedReservation.id}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">部屋タイプ:</span>{" "}
                      {roomTypeMapping[selectedReservation.roomType] || selectedReservation.roomType}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">利用日時</h3>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">利用開始:</span>{" "}
                      {formatTimestamp(selectedReservation.startDateTime)}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">利用終了:</span>{" "}
                      {formatTimestamp(selectedReservation.endDateTime)}
                    </p>
                    {selectedReservation.slowRoomAsSetPlan && (
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">スロールーム:</span>{" "}
                        {formatTimestamp(selectedReservation.slowRoomStartDateTime)} ~ {formatTimestamp(selectedReservation.slowRoomEndDateTime)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {loadingRooms ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500 font-zen-kaku-gothic">
                    部屋の空き状況を確認中...
                  </p>
                </div>
              ) : (
                <div className="p-4">
                  {/* 主房间分配部分 */}
                  <div className="mb-4">
                    {selectedReservation.hasRoomAssignment && generatedCard ? (
                      <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
                        <h3 className="text-md font-medium text-gray-700 mb-3 font-zen-kaku-gothic">
                          割り当て済み - {roomTypeMapping[selectedReservation.roomType] || selectedReservation.roomType}：
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-700 mb-1">
                              <span className="font-medium">部屋番号:</span> {generatedCard.physicalRoomId.replace("room_", "")}
                            </p>
                            <p className="text-sm text-gray-700 mb-1">
                              <span className="font-medium">カード番号:</span> {generatedCard.cardNumber}
                            </p>
                            <p className="text-sm text-gray-700 mb-1">
                              <span className="font-medium">有効期間:</span>{" "}
                              {formatTimestamp(generatedCard.startAt)} ~ {formatTimestamp(generatedCard.endAt)}
                            </p>
                          </div>
                          <div className="flex justify-center items-center">
                            {generatedCard.barcode && (
                              <div>
                                {generatedCard.barcode.startsWith("data:image") ? (
                                  <Image
                                    src={generatedCard.barcode}
                                    alt="バーコード"
                                    width={300}
                                    height={100}
                                    className="max-w-full h-auto"
                                  />
                                ) : (
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: generatedCard.barcode,
                                    }}
                                    className="max-w-full overflow-auto"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-md font-medium text-gray-700 mb-3 font-zen-kaku-gothic">
                          {roomTypeMapping[selectedReservation.roomType] ||
                            selectedReservation.roomType}
                          ：
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {Object.entries(availableRooms).map(
                            ([roomId, isAvailable]) => {
                              // 确认：这个房间是否与预约的类型匹配？
                              const isMatched = isRoomTypeMatch(
                                roomId,
                                selectedReservation.roomType
                              );

                              // 跳过不匹配房间类型的房间
                              if (!isMatched) {
                                return null;
                              }

                              return (
                                <div
                                  key={roomId}
                                  className={`border rounded-md p-3 text-center ${
                                    !isAvailable
                                      ? "bg-gray-100 opacity-50"
                                      : !isMatched
                                      ? "bg-gray-50 border-gray-300"
                                      : selectedRoom === roomId
                                      ? "bg-white border-2 border-blue-700 shadow-sm"
                                      : "bg-white border-gray-300 hover:border-blue-500 cursor-pointer"
                                  }`}
                                  onClick={() => {
                                    if (
                                      isAvailable &&
                                      isMatched &&
                                      !generatedCard
                                    ) {
                                      handleRoomSelection(roomId);
                                    }
                                  }}
                                >
                                  <div className="font-medium text-gray-900">
                                    {roomId.replace("room_", "")}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {roomNumberToType[roomId]
                                      ? roomTypeMapping[
                                          roomNumberToType[roomId]
                                        ]
                                      : "不明"}
                                  </div>
                                  <div
                                    className={`text-xs mt-2 px-2 py-1 rounded-full ${
                                      !isAvailable
                                        ? "bg-red-100 text-red-800"
                                        : "bg-green-100 text-green-800"
                                    }`}
                                  >
                                    {isAvailable ? "空き" : "使用中"}
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Slow Room分配部分 - 仅在套餐预约且需要分配时显示 */}
                  {showSetPlanSection && selectedReservation?.slowRoomAsSetPlan && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      {selectedReservation.hasSlowRoomAssignment && generatedSlowRoomCard ? (
                        <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
                          <h3 className="text-md font-medium text-gray-700 mb-3 font-zen-kaku-gothic">
                            割り当て済み - スロールーム：
                            {generatedSlowRoomCard.startAt && (
                              <span className="text-xs ml-2 text-gray-500">
                                ({formatTimestamp(generatedSlowRoomCard.startAt).split(' ')[1]})
                              </span>
                            )}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-700 mb-1">
                                <span className="font-medium">部屋番号:</span> {generatedSlowRoomCard.physicalRoomId.replace("room_", "")}
                              </p>
                              <p className="text-sm text-gray-700 mb-1">
                                <span className="font-medium">カード番号:</span> {generatedSlowRoomCard.cardNumber}
                              </p>
                              <p className="text-sm text-gray-700 mb-1">
                                <span className="font-medium">有効期間:</span>{" "}
                                {formatTimestamp(generatedSlowRoomCard.startAt)} ~ {formatTimestamp(generatedSlowRoomCard.endAt)}
                              </p>
                            </div>
                            <div className="flex justify-center items-center">
                              {generatedSlowRoomCard.barcode && (
                                <div>
                                  {generatedSlowRoomCard.barcode.startsWith("data:image") ? (
                                    <Image
                                      src={generatedSlowRoomCard.barcode}
                                      alt="スロールームバーコード"
                                      width={300}
                                      height={100}
                                      className="max-w-full h-auto"
                                    />
                                  ) : (
                                    <div
                                      dangerouslySetInnerHTML={{
                                        __html: generatedSlowRoomCard.barcode,
                                      }}
                                      className="max-w-full overflow-auto"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-md font-medium text-gray-700 mb-3 font-zen-kaku-gothic">
                            セットプラン - スロールーム：
                            {selectedReservation.slowRoomStartDateTime && (
                              <span className="text-xs ml-2 text-gray-500">
                                ({formatTimestamp(selectedReservation.slowRoomStartDateTime).split(' ')[1]})
                              </span>
                            )}
                          </h3>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {Object.entries(availableSlowRooms).map(
                              ([roomId, isAvailable]) => {
                                // Slow Room总是匹配的
                                const isMatched =
                                  roomNumberToType[roomId] === "slow_room";

                                // 跳过不是Slow Room类型的房间
                                if (!isMatched) {
                                  return null;
                                }

                                return (
                                  <div
                                    key={roomId}
                                    className={`border rounded-md p-3 text-center ${
                                      !isAvailable
                                        ? "bg-gray-100 opacity-50"
                                        : !isMatched
                                        ? "bg-gray-50 border-gray-300"
                                        : selectedSlowRoom === roomId
                                        ? "bg-white border-2 border-blue-700 shadow-sm"
                                        : "bg-white border-gray-300 hover:border-blue-500 cursor-pointer"
                                    }`}
                                    onClick={() => {
                                      if (
                                        isAvailable &&
                                        isMatched &&
                                        !generatedSlowRoomCard
                                      ) {
                                        handleSlowRoomSelection(roomId);
                                      }
                                    }}
                                  >
                                    <div className="font-medium text-gray-900">
                                      {roomId.replace("room_", "")}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      スロールーム
                                    </div>
                                    <div
                                      className={`text-xs mt-2 px-2 py-1 rounded-full ${
                                        !isAvailable
                                          ? "bg-red-100 text-red-800"
                                          : "bg-green-100 text-green-800"
                                      }`}
                                    >
                                      {isAvailable ? "空き" : "使用中"}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 只在尚未分配房间时显示确认按钮 */}
                  {!selectedReservation.hasRoomAssignment && (selectedRoom || selectedReservation.hasRoomAssignment) &&
                    (!showSetPlanSection ||
                      selectedSlowRoom ||
                      selectedReservation.hasSlowRoomAssignment) &&
                    !generatedCard && (
                      <div className="border-t border-gray-200 pt-4 pb-2 px-4 mt-4 flex justify-end">
                        <button
                          onClick={showConfirmationDialog}
                          className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={
                            issuingCard ||
                            (!selectedRoom &&
                              !selectedReservation.hasRoomAssignment)
                          }
                        >
                          {issuingCard
                            ? "処理中..."
                            : "この部屋でカードを発行する"}
                        </button>
                      </div>
                    )}
                  
                  {/* 邮件发送部分 - 仅在已分配且未发邮件的预约进入时显示（不是通过发行卡片按钮生成的情况） */}
                  {selectedReservation?.hasRoomAssignment && !emailSent && (
                    <div className="border-t border-gray-200 mt-6 pt-4 pb-2 px-4">
                      <div className="bg-gray-50 p-4 rounded-md">
                        <h3 className="text-md font-medium text-gray-700 mb-3 font-zen-kaku-gothic">
                          カード情報メール送信
                        </h3>
                        {emailSent ? (
                          <div className="text-center">
                            <p className="text-green-600 font-medium font-zen-kaku-gothic">
                              ✓ カード情報のメールが送信済みです
                            </p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-sm text-gray-600 font-zen-kaku-gothic mb-4">
                              お客様にカード情報のメールを送信します。
                            </p>
                            <button
                              onClick={sendCardEmail}
                              disabled={sendingEmail}
                              className={`px-4 py-2 rounded-md text-sm font-zen-kaku-gothic ${
                                sendingEmail
                                  ? "bg-gray-400 text-white"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                              }`}
                            >
                              {sendingEmail
                                ? "送信中..."
                                : "お客様にメール送信"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 邮件发送成功提示 - 当在已分配房间页面发送邮件成功后显示 */}
          {selectedReservation?.hasRoomAssignment && emailSent && (
            <div className="mt-6 bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <p className="text-lg font-medium text-green-700 font-zen-kaku-gothic">
                    メール送信完了
                  </p>
                </div>
                <p className="text-sm text-green-600 font-zen-kaku-gothic">
                  カード情報のメールがお客様に正常に送信されました。
                </p>
                <button
                  onClick={goBackToList}
                  className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-800"
                >
                  一覧に戻る
                </button>
              </div>
            </div>
          )}

          {/* 生成されたカード - 仅当通过本页面新生成卡片时显示 */}
          {(generatedCard || generatedSlowRoomCard) && !selectedReservation?.hasRoomAssignment && (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200 mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-800 font-zen-kaku-gothic">
                  生成されたカード
                </h2>
              </div>

              {/* 主房间卡片 */}
              {generatedCard && (
                <div className="mb-6">
                  <h3 className="text-md font-medium text-gray-700 mb-3 font-zen-kaku-gothic border-b pb-2">
                    {roomTypeMapping[selectedReservation?.roomType || ""] ||
                      "メイン部屋"}
                    ：
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                        <span className="font-medium">カード番号:</span>{" "}
                        {generatedCard.cardNumber}
                      </p>
                      <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                        <span className="font-medium">部屋番号:</span>{" "}
                        {generatedCard.physicalRoomId.replace("room_", "")}
                      </p>
                      <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                        <span className="font-medium">有効期間:</span>{" "}
                        {formatTimestamp(generatedCard.startAt)} ~{" "}
                        {formatTimestamp(generatedCard.endAt)}
                      </p>
                    </div>

                    <div className="flex flex-col items-center">
                      {generatedCard.barcode && (
                        <div>
                          {generatedCard.barcode.startsWith("data:image") ? (
                            <Image
                              src={generatedCard.barcode}
                              alt="Barcode"
                              width={400}
                              height={120}
                              className="mx-auto max-w-full h-auto"
                            />
                          ) : (
                            <div
                              dangerouslySetInnerHTML={{
                                __html: generatedCard.barcode,
                              }}
                              className="mx-auto overflow-auto"
                              style={{ maxWidth: "100%" }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Slow Room卡片 */}
              {generatedSlowRoomCard && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-md font-medium text-gray-700 mb-3 font-zen-kaku-gothic border-b pb-2">
                    セットプラン - スロールーム：
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                        <span className="font-medium">カード番号:</span>{" "}
                        {generatedSlowRoomCard.cardNumber}
                      </p>
                      <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                        <span className="font-medium">部屋番号:</span>{" "}
                        {generatedSlowRoomCard.physicalRoomId.replace(
                          "room_",
                          ""
                        )}
                      </p>
                      <p className="text-sm text-gray-700 mb-1 font-zen-kaku-gothic">
                        <span className="font-medium">有効期間:</span>{" "}
                        {formatTimestamp(generatedSlowRoomCard.startAt)} ~{" "}
                        {formatTimestamp(generatedSlowRoomCard.endAt)}
                      </p>
                    </div>

                    <div className="flex flex-col items-center">
                      {generatedSlowRoomCard.barcode && (
                        <div>
                          {generatedSlowRoomCard.barcode.startsWith(
                            "data:image"
                          ) ? (
                            <Image
                              src={generatedSlowRoomCard.barcode}
                              alt="Slow Room Barcode"
                              width={400}
                              height={120}
                              className="mx-auto max-w-full h-auto"
                            />
                          ) : (
                            <div
                              dangerouslySetInnerHTML={{
                                __html: generatedSlowRoomCard.barcode,
                              }}
                              className="mx-auto overflow-auto"
                              style={{ maxWidth: "100%" }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 text-center">
                {emailSent ? (
                  <div className="mb-4">
                    <p className="text-green-600 font-medium font-zen-kaku-gothic">
                      ✓ カード情報のメールが送信済みです
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 font-zen-kaku-gothic mb-4">
                    このカードは正常に発行され、データベースに保存されました。
                    お客様にメールで送信する必要があります。
                  </p>
                )}
                <div className="mt-4">
                  <button
                    onClick={sendCardEmail}
                    disabled={sendingEmail || emailSent}
                    className={`px-4 py-2 rounded-md text-sm font-zen-kaku-gothic ${
                      emailSent
                        ? "bg-green-500 text-white"
                        : sendingEmail
                        ? "bg-gray-400 text-white"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {emailSent
                      ? "✓ メール送信完了"
                      : sendingEmail
                      ? "送信中..."
                      : "お客様にメール送信"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 确认对话框 */}
          {showConfirmDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4 font-zen-kaku-gothic">
                  カード発行の確認
                </h3>
                <p className="text-sm text-gray-600 mb-6 font-zen-kaku-gothic">
                  部屋番号 {selectedRoom?.replace("room_", "")}{" "}
                  のカードを発行しますか？
                  発行後の変更はできませんのでご注意ください。
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={cancelIssueCard}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-300"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={confirmIssueCard}
                    className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-zen-kaku-gothic hover:bg-gray-700"
                  >
                    発行する
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </Layout>
  );
}
