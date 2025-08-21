import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";

// 确保Firebase Admin已初始化
initAdmin();

export async function POST(req: Request) {
  try {
    // 获取授权头部
    const authHeader = req.headers.get("authorization");
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

    // 检查管理员权限
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    // 解析请求体
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return NextResponse.json(
        { error: "リクエストボディの解析に失敗しました" },
        { status: 400 }
      );
    }

    const { reservationId, cancelReason } = requestBody;

    // 验证请求参数
    if (!reservationId) {
      return NextResponse.json(
        { error: "予約IDが必要です" },
        { status: 400 }
      );
    }

    // 验证是否是外部预约ID
    if (!reservationId.startsWith("external_")) {
      return NextResponse.json(
        { error: "無効な予約IDです" },
        { status: 400 }
      );
    }

    // 获取数据库实例
    const db = getFirestore();

    // 检查外部预约是否存在
    const reservationDoc = await db.collection("externalReservations").doc(reservationId).get();

    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: "予約情報が見つかりません" },
        { status: 404 }
      );
    }

    const reservationData = reservationDoc.data();

    if (!reservationData) {
      return NextResponse.json(
        { error: "予約データが無効です" },
        { status: 400 }
      );
    }

    // 检查是否已经被取消
    if (reservationData.isCancelled) {
      return NextResponse.json(
        { error: "この予約はすでにキャンセルされています" },
        { status: 400 }
      );
    }

    // 更新数据库中的状态
    await db
      .collection("externalReservations")
      .doc(reservationId)
      .update({
        isCancelled: true,
        cancelledAt: Timestamp.fromDate(new Date()),
        cancelledBy: decodedToken.uid,
        cancelReason: cancelReason || "",
        status: "cancelled",
        updatedAt: Timestamp.fromDate(new Date()),
      });

    console.log(`外部予約 ${reservationId} がキャンセルされました by ${decodedToken.uid}`);

    return NextResponse.json({
      success: true,
      message: "カードが正常にキャンセルされました",
      reservationId,
    });
  } catch (error) {
    console.error("Error cancelling external card:", error);
    return NextResponse.json(
      {
        error: "カードキャンセル中にエラーが発生しました",
        details: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";