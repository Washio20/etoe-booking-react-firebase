import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// 确保Firebase Admin已初始化
initAdmin();

export async function GET(req: Request) {
  try {
    // 获取URL参数
    const url = new URL(req.url);
    const reservationId = url.searchParams.get("reservationId");
    const cardId = url.searchParams.get("cardId");
    const token = url.searchParams.get("token");

    // 验证必要参数
    if (!reservationId || !cardId) {
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
    const expectedToken = `${reservationId.slice(0, 8)}${cardId.slice(0, 8)}`;
    if (token !== expectedToken) {
      return NextResponse.json(
        { error: "無効なアクセストークンです" },
        { status: 403 }
      );
    }

    // 获取数据库实例
    const db = getFirestore();

    // 获取房卡信息
    const cardDoc = await db.collection("roomCards").doc(cardId).get();
    if (!cardDoc.exists) {
      return NextResponse.json(
        { error: "カード情報が見つかりません" },
        { status: 404 }
      );
    }

    const cardData = cardDoc.data();
    if (!cardData) {
      return NextResponse.json(
        { error: "カードデータが無効です" },
        { status: 500 }
      );
    }

    // 获取外部预约信息
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

    // 验证卡片所属于正确的预订
    if (cardData.reservationId && cardData.reservationId !== reservationId) {
      return NextResponse.json(
        { error: "カードと予約の情報が一致しません" },
        { status: 403 }
      );
    }

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