import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";

// 确保Firebase Admin已初始化
initAdmin();

// 获取预约关联的卡片
export async function GET(req: Request) {
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

    // 获取查询参数
    const urlSearchParams = new URL(req.url).searchParams;
    const reservationId = urlSearchParams.get("reservationId");

    if (!reservationId) {
      return NextResponse.json(
        { error: "予約IDが必要です" },
        { status: 400 }
      );
    }

    const db = getFirestore();

    // 获取与预约关联的卡片
    const cardsCollection = db.collection("roomCards");
    const query = cardsCollection.where("reservationId", "==", reservationId);
    const cardsSnapshot = await query.get();

    if (cardsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        cards: []
      });
    }

    const cards = cardsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        reservationId: data.reservationId,
        cardNumber: data.cardNumber,
        cardKey: data.cardKey,
        barcode: data.barcode,
        qrcode: data.qrcode,
        physicalRoomId: data.physicalRoomId,
        deviceId: data.deviceId,
        startAt: data.startAt,
        endAt: data.endAt,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });

    return NextResponse.json({
      success: true,
      cards: cards
    });
  } catch (error) {
    console.error("Error getting cards:", error);
    return NextResponse.json(
      { error: "カード情報の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic"; 