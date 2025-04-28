import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Reservation } from "@/types/reservation";

// 确保Firebase Admin已初始化
initAdmin();

// 定义Firestore Timestamp类型
interface FirestoreTimestamp {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
}

// 帮助函数，将Firestore Timestamp转换为Date对象
function toDate(timestamp: FirestoreTimestamp | null | undefined): Date | null {
  if (!timestamp) return null;
  return timestamp.toDate();
}

// 获取单个预约详情
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const reservationId = params.id;

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

    // 检查是否为管理员
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return NextResponse.json(
        { error: "管理者権限がありません" },
        { status: 403 }
      );
    }

    // 获取预约详情
    const db = getFirestore();
    const reservationDoc = await db
      .collection("reservations")
      .doc(reservationId)
      .get();

    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: "予約データが見つかりません" },
        { status: 404 }
      );
    }

    // 格式化数据
    const reservationData = reservationDoc.data();

    // 获取用户完整信息
    let userFullName = reservationData?.userFullName || null;
    
    // 如果没有用户全名且有userId，尝试从users集合获取
    if (!userFullName && reservationData?.userId) {
      try {
        const userDoc = await db.collection("users").doc(reservationData.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userFullName = userData?.fullName || null;
        }
      } catch (error) {
        console.error("获取用户信息失败:", error);
      }
    }

    // 处理预约详情数据
    const reservation = {
      id: reservationDoc.id,
      ...reservationData,
      // 添加用户全名
      userFullName: userFullName,
      // 处理日期时间字段 - 保留原始格式，让前端处理显示
      createdAt: reservationData?.createdAt || null,
      updatedAt: reservationData?.updatedAt || null,
      // 保留其他Timestamp字段的原始格式，由前端处理转换
      bookingDate: reservationData?.bookingDate || null,
      startDateTime: reservationData?.startDateTime || null,
      endDateTime: reservationData?.endDateTime || null,
      slowRoomStartDateTime: reservationData?.slowRoomStartDateTime || null,
      slowRoomEndDateTime: reservationData?.slowRoomEndDateTime || null,
    } as Reservation;

    return NextResponse.json({ reservation });
  } catch (error) {
    console.error("Error retrieving reservation:", error);
    return NextResponse.json(
      { error: "予約の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 删除预约
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const reservationId = params.id;

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

    // 检查是否为管理员
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return NextResponse.json(
        { error: "管理者権限がありません" },
        { status: 403 }
      );
    }

    // 删除预约
    const db = getFirestore();

    // 先检查预约是否存在
    const reservationDoc = await db
      .collection("reservations")
      .doc(reservationId)
      .get();

    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: "予約データが見つかりません" },
        { status: 404 }
      );
    }

    // 执行删除操作
    await db.collection("reservations").doc(reservationId).delete();

    return NextResponse.json({
      success: true,
      message: "予約が正常に削除されました",
    });
  } catch (error) {
    console.error("Error deleting reservation:", error);
    return NextResponse.json(
      { error: "予約の削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
