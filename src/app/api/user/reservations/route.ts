import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// 确保Firebase Admin已初始化
initAdmin();

// 预约接口定义 - 更新为使用新的字段结构
interface Reservation {
  id: string;
  userId: string;
  userEmail: string;
  roomType: string;
  plan?: string;
  price: number; // 现在是数字类型
  paymentStatus: string;
  paymentId?: string;

  // 新的日期时间字段
  bookingDate: any;
  startDateTime: any;
  endDateTime: any;

  // 可选的慢房间字段
  slowRoomAsSetPlan?: boolean;
  slowRoomStartDateTime?: any;
  slowRoomEndDateTime?: any;

  // UI显示字段
  displayDate?: string;
  displayTimeRange?: string;
  displaySlowRoomTimeRange?: string;

  // 元数据
  createdAt: any;
  updatedAt: any;

  [key: string]: any; // 允许其他属性
}

// 房间信息接口
interface Room {
  id: string;
  roomType: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  name?: string;
}

// 获取用户自己的预约列表
export async function GET(request: Request) {
  try {
    // 获取授权头部
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "認証トークンが必要です" },
        { status: 401 }
      );
    }

    // 提取令牌
    const idToken = authHeader.split("Bearer ")[1];

    // 验证Firebase ID令牌
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Firebase token verification failed:", error);
      return NextResponse.json(
        { error: "認証トークンが無効です" },
        { status: 401 }
      );
    }

    // 获取用户ID
    const userId = decodedToken.uid;

    // 获取所有预约
    const db = getFirestore();

    // 获取URL查询参数
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const status = url.searchParams.get("status");

    // 创建基础查询 - 只查询该用户的预约
    const reservationsRef = db.collection("reservations");

    // 这里可以直接使用where查询，因为我们查询的是特定用户的预约
    let query = reservationsRef.where("userId", "==", userId);

    // 添加状态筛选
    if (status) {
      query = query.where("paymentStatus", "==", status);
    }

    // 添加排序和限制 - 按创建时间降序排列
    query = query.orderBy("createdAt", "desc").limit(limit);

    // 执行查询
    const snapshot = await query.get();

    // 格式化结果
    const reservations = snapshot.docs.map((doc) => {
      const data = doc.data();

      // 确保所有日期时间字段都是JS Date对象
      const formattedData = {
        id: doc.id,
        ...data,
        // 转换时间戳字段为Date对象
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        bookingDate: data.bookingDate?.toDate?.() || data.bookingDate,
        startDateTime: data.startDateTime?.toDate?.() || data.startDateTime,
        endDateTime: data.endDateTime?.toDate?.() || data.endDateTime,

        // 慢房间时间（如果有）
        slowRoomStartDateTime:
          data.slowRoomStartDateTime?.toDate?.() || data.slowRoomStartDateTime,
        slowRoomEndDateTime:
          data.slowRoomEndDateTime?.toDate?.() || data.slowRoomEndDateTime,
      };

      return formattedData as Reservation;
    });

    // 获取所有涉及的房间类型
    const roomTypes = Array.from(new Set(reservations.map(res => res.roomType)));
    
    // 批量获取房间信息
    const roomsMap = new Map<string, Room>();
    
    if (roomTypes.length > 0) {
      try {
        // 获取所有房间信息（因为房间数量通常不多，直接获取全部）
        const roomsSnapshot = await db.collection("rooms").get();
        
        roomsSnapshot.docs.forEach(doc => {
          const roomData = doc.data();
          if (roomTypes.includes(roomData.roomType)) {
            roomsMap.set(roomData.roomType, {
              id: doc.id,
              roomType: roomData.roomType,
              imageUrl: roomData.imageUrl,
              thumbnailUrl: roomData.thumbnailUrl,
              name: roomData.name,
            });
          }
        });
      } catch (error) {
        console.error("Error fetching room data:", error);
        // 如果获取房间信息失败，继续处理但不添加图片
      }
    }

    // 构建房间类型名称映射
    const roomTypeNames: Record<string, string> = {
      tototo: "TOTOTO",
      fuuu: "FUUU",
      zabuun: "ZABUUN",
      toron: "TORON",
      sauna_suite: "サウナスイート",
      slow_room: "スロールーム",
    };

    // 添加可读的房间名称和图片URL
    const enhancedReservations = reservations.map((res) => {
      const room = roomsMap.get(res.roomType);
      
      return {
        ...res,
        roomTypeName: roomTypeNames[res.roomType] || res.roomType,
        // 添加房间图片，优先使用thumbnailUrl，其次imageUrl，最后默认图片
        imageUrl: room?.thumbnailUrl || room?.imageUrl || "/images/room.png",
      };
    });

    return NextResponse.json({
      reservations: enhancedReservations,
      total: enhancedReservations.length,
    });
  } catch (error) {
    console.error("Error retrieving user reservations:", error);
    return NextResponse.json(
      { error: "予約の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
