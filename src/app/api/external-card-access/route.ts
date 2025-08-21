import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

// 确保Firebase Admin已初始化
initAdmin();

// 生成和验证安全令牌的函数
const generateSecureToken = (reservationId: string, secretKey = process.env.TOKEN_SECRET || "etoe_hotel_token_secret"): string => {
  // 使用HMAC-SHA256生成令牌，这样令牌与预约ID和密钥相关联
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(reservationId);
  // 返回前16个字符作为令牌，足够安全又不会太长
  return hmac.digest('hex').substring(0, 16);
};

export async function GET(req: Request) {
  try {
    // 获取URL参数
    const url = new URL(req.url);
    const reservationId = url.searchParams.get("reservationId");
    const cardId = url.searchParams.get("cardId");
    const token = url.searchParams.get("token");

    // 验证必要参数
    if (!reservationId) {
      return NextResponse.json(
        { error: "必要なパラメータが不足しています" },
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

    // 验证安全令牌
    const expectedToken = generateSecureToken(reservationId);
    if (token !== expectedToken) {
      return NextResponse.json(
        { error: "無効なアクセストークンです" },
        { status: 403 }
      );
    }

    // 获取数据库实例
    const db = getFirestore();

    // 获取外部预约信息（已包含卡片数据）
    const reservationDoc = await db
      .collection("externalReservations")
      .doc(reservationId)
      .get();

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
        { status: 500 }
      );
    }

    // 检查卡片是否已被取消
    if (reservationData.isCancelled) {
      return NextResponse.json(
        { 
          error: "このカードはキャンセルされています。\n\nご不明な点がございましたら、施設までお問い合わせください。",
          isCancelled: true
        },
        { status: 403 }
      );
    }

    // 检查预约状态
    if (reservationData.status === "cancelled") {
      return NextResponse.json(
        { 
          error: "この予約はキャンセルされています。\n\nご不明な点がございましたら、施設までお問い合わせください。",
          isCancelled: true
        },
        { status: 403 }
      );
    }

    // 从外部预约数据中提取卡片信息
    const cardData = {
      id: reservationId, // 使用预约ID作为卡片ID
      cardNumber: reservationData.cardNumber,
      cardKey: reservationData.cardKey,
      barcode: reservationData.barcode,
      qrcode: reservationData.qrcode,
      physicalRoomId: reservationData.physicalRoomId,
      deviceId: reservationData.deviceId,
      startAt: reservationData.startAt,
      endAt: reservationData.endAt,
      status: reservationData.cardStatus,
      createdAt: reservationData.createdAt,
      updatedAt: reservationData.updatedAt,
      reservationId: reservationId,
      isExternalReservation: true,
    };

    // 准备用户数据
    const userData = {
      userEmail: reservationData.userEmail || null,
      userName: reservationData.userName || null,
      userFullName: null,
    };

    // 返回成功结果，包含用户信息
    return NextResponse.json({
      success: true,
      card: cardData,
      reservation: userData,
      isExternalReservation: true,
    });
  } catch (error) {
    console.error("カード情報取得エラー:", error);
    return NextResponse.json(
      { error: "カード情報の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic"; 