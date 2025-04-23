import { NextRequest, NextResponse } from "next/server";
import { initAdmin, adminDb } from "@/utils/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import {
  getFirestore,
  Query,
  DocumentData,
  Timestamp,
} from "firebase-admin/firestore";
import { Room } from "@/types/room";

// 确保Firebase Admin已初始化
const app = initAdmin();

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";

// 获取所有房间信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomType = searchParams.get("roomType");
    const roomId = searchParams.get("id"); // 添加id参数支持

    // 获取Firestore实例
    const db = getFirestore();

    // 如果提供了id参数，获取单个房间信息
    if (roomId) {
      const docRef = db.collection("rooms").doc(roomId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return NextResponse.json(
          { error: "指定された客室が見つかりませんでした" },
          { status: 404 }
        );
      }

      const data = doc.data();
      const room = {
        id: doc.id,
        name: data?.name,
        roomType: data?.roomType,
        category: data?.category,
        capacity: data?.capacity,
        area: data?.area,
        description: data?.description,
        imageUrl: data?.imageUrl,
        thumbnailUrl: data?.thumbnailUrl,
        prices: data?.prices || [],
        extension: data?.extension,
        duration: data?.duration,
        facilities: data?.facilities || [],
        displayOrder: data?.displayOrder || 0,
        isActive: data?.isActive !== false, // 默认为true
        timeSlots: data?.timeSlots || [],
        dailyInventory: data?.dailyInventory || {}, // 确保返回dailyInventory字段
        createdAt:
          data?.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : data?.createdAt,
        updatedAt:
          data?.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate()
            : data?.updatedAt,
      };

      return NextResponse.json({ rooms: [room] });
    }

    // 创建基本查询
    let roomsRef = db.collection("rooms");
    let query: Query<DocumentData> = roomsRef;

    // 如果提供了roomType参数，添加过滤条件
    if (roomType) {
      query = query.where("roomType", "==", roomType);
    }

    // 执行查询
    const snapshot = await query.get();

    if (snapshot.empty) {
      return NextResponse.json({ rooms: [] });
    }

    // 转换结果为对象数组
    const rooms = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        roomType: data.roomType,
        category: data.category,
        capacity: data.capacity,
        area: data.area,
        description: data.description,
        imageUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        prices: data.prices || [],
        extension: data.extension,
        duration: data.duration,
        facilities: data.facilities || [],
        displayOrder: data.displayOrder || 0,
        isActive: data.isActive !== false, // 默认为true
        timeSlots: data.timeSlots || [],
        dailyInventory: data.dailyInventory || {}, // 确保返回dailyInventory字段
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : data.createdAt,
        updatedAt:
          data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate()
            : data.updatedAt,
      };
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("获取房间信息失败:", error);
    return NextResponse.json({ error: "获取房间信息失败" }, { status: 500 });
  }
}

// 创建或更新房间信息
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];

    // 验证令牌
    const auth = getAuth();
    try {
      const decodedToken = await auth.verifyIdToken(idToken);

      // 验证用户是否为管理员
      const isAdmin = decodedToken.admin === true;

      if (!isAdmin) {
        return NextResponse.json(
          { error: "管理者権限が必要です。" },
          { status: 403 }
        );
      }

      // 获取请求数据
      const roomData = await request.json();

      // 基本验证
      if (!roomData.roomType || !roomData.category) {
        return NextResponse.json(
          { error: "必須フィールドが不足しています。" },
          { status: 400 }
        );
      }

      // 准备存储的数据
      const now = new Date();
      const room: Partial<Room> = {
        ...roomData,
        updatedAt: now,
      };

      // 如果是新增房间，添加创建时间
      if (!roomData.id) {
        room.createdAt = now;
      }

      // 存储到Firestore
      const db = getFirestore();

      let roomId;
      if (roomData.id) {
        // 更新现有房间
        roomId = roomData.id;
        const roomRef = db.collection("rooms").doc(roomId);

        // 创建一个不包含id属性的副本
        const roomDataToUpdate = { ...room };
        delete roomDataToUpdate.id; // 删除id属性而不是设为undefined

        await roomRef.update(roomDataToUpdate);
      } else {
        // 创建新房间
        const roomRef = db.collection("rooms").doc();
        roomId = roomRef.id;
        await roomRef.set({
          ...room,
          id: roomId,
        });
      }

      return NextResponse.json({
        success: true,
        roomId,
        message: roomData.id
          ? "部屋情報が更新されました。"
          : "新しい部屋が作成されました。",
      });
    } catch (error) {
      console.error("令牌验证失败:", error);
      return NextResponse.json(
        { error: "無効な認証トークンです。" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("保存房间信息失败:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}

// 删除房间信息
export async function DELETE(request: NextRequest) {
  try {
    // 验证管理员权限
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];

    // 验证令牌
    const auth = getAuth();
    try {
      const decodedToken = await auth.verifyIdToken(idToken);

      // 验证用户是否为管理员
      const isAdmin = decodedToken.admin === true;

      if (!isAdmin) {
        return NextResponse.json(
          { error: "管理者権限が必要です。" },
          { status: 403 }
        );
      }

      // 获取URL参数
      const url = new URL(request.url);
      const roomId = url.searchParams.get("id");

      if (!roomId) {
        return NextResponse.json(
          { error: "部屋IDが必要です。" },
          { status: 400 }
        );
      }

      // 从Firestore删除房间
      const db = getFirestore();
      await db.collection("rooms").doc(roomId).delete();

      return NextResponse.json({
        success: true,
        message: "部屋が削除されました。",
      });
    } catch (error) {
      console.error("令牌验证失败:", error);
      return NextResponse.json(
        { error: "無効な認証トークンです。" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("删除房间失败:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
