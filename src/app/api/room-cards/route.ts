import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";

// 确保Firebase Admin已初始化
initAdmin();

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

    // 获取URL参数
    const url = new URL(req.url);
    const reservationId = url.searchParams.get("reservationId");

    const db = getFirestore();
    let cardsQuery;

    // 如果指定了预约ID，只获取该预约的卡
    if (reservationId) {
      cardsQuery = db
        .collection("roomCards")
        .where("reservationId", "==", reservationId);
    } else {
      // 获取用户的所有预约
      const reservationsSnapshot = await db
        .collection("reservations")
        .where("userId", "==", decodedToken.uid)
        .get();

      const reservationIds = reservationsSnapshot.docs.map((doc) => doc.id);

      if (reservationIds.length === 0) {
        return NextResponse.json({ cards: [] });
      }

      // 获取用户所有预约的卡
      cardsQuery = db
        .collection("roomCards")
        .where("reservationId", "in", reservationIds);
    }

    // 执行查询
    const cardsSnapshot = await cardsQuery.get();
    const cards = cardsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Error fetching room cards:", error);
    return NextResponse.json(
      { error: "カード情報の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
