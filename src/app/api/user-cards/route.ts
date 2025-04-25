import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// 确保Firebase Admin已初始化
initAdmin();

// 辅助函数：处理返回给前端的时间戳格式
const processTimestamp = (timestamp: any) => {
  if (!timestamp) return null;

  // 如果是Firestore Timestamp对象
  if (
    typeof timestamp === "object" &&
    timestamp.toDate &&
    typeof timestamp.toDate === "function"
  ) {
    const date = timestamp.toDate();
    // 将Firebase Timestamp转换为包含seconds的对象格式
    return { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 };
  }

  return timestamp;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    const authHeader = req.headers.get("authorization") || null;

    let userEmail = email;
    let userId = null;

    // 如果没有提供email参数但提供了认证令牌，尝试从令牌获取用户信息
    if (!userEmail && authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await getAuth().verifyIdToken(idToken);
        userEmail = decodedToken.email || null;
        userId = decodedToken.uid || null;
      } catch (authError) {
        console.error("認証エラー:", authError);
      }
    }

    // 如果仍然没有用户邮箱，返回错误
    if (!userEmail) {
      return NextResponse.json(
        {
          error:
            "ユーザー情報が取得できません。emailパラメータまたは有効な認証トークンが必要です。",
          success: false,
        },
        { status: 400 }
      );
    }

    // 获取数据库实例
    const db = getFirestore();

    // 获取用户信息
    let userFullName = null;
    if (userId) {
      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData) {
            userFullName = userData.fullName || null;
          }
        }
      } catch (userError) {
        console.error("ユーザー情報取得エラー:", userError);
      }
    }

    // 获取当前时间作为Firestore Timestamp
    const now = new Date();

    // 查询用户预约信息
    const reservationsRef = db.collection("reservations");
    const query = reservationsRef
      .where("userEmail", "==", userEmail)
      .where("paymentStatus", "==", "paid") // 只查询已支付的预约
      .where("cardEmailSent", "==", true) // 只查询已发送卡片邮件的预约
      .where("endDateTime", ">", now) // 只查询未过期的预约
      .orderBy("endDateTime", "asc") // 按照结束时间排序，优先显示最早结束的
      .limit(1); // 获取最近的一条预约

    const reservationsSnapshot = await query.get();

    // 如果没有找到预约
    if (reservationsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "有効な予約が見つかりません",
        reservationId: null,
        cards: [],
      });
    }

    // 获取预约
    const reservation = reservationsSnapshot.docs[0];
    const reservationData = reservation.data();
    const reservationId = reservation.id;

    console.log("找到有效预约:", {
      id: reservationId,
      paymentStatus: reservationData.paymentStatus,
      endDateTime: reservationData.endDateTime?.toDate(),
    });

    // 获取与此预约关联的所有卡片
    const cardsRef = db.collection("roomCards");
    const cardQuery = cardsRef.where("reservationId", "==", reservationId);

    const cardSnapshot = await cardQuery.get();
    const cards = [];

    // 如果找到关联卡片，收集卡片信息
    if (!cardSnapshot.empty) {
      for (const doc of cardSnapshot.docs) {
        const cardData = doc.data();
        cards.push({
          id: doc.id,
          barcode: cardData.barcode || null,
          qrcode: cardData.qrcode || null,
          physicalRoomId: cardData.physicalRoomId || null,
          cardNumber: cardData.cardNumber || null,
          startAt: processTimestamp(cardData.startAt),
          endAt: processTimestamp(cardData.endAt),
        });
      }
      console.log(`找到 ${cards.length} 个关联卡片`);
    } else {
      console.log("没有找到关联卡片");
    }

    // 处理时间戳字段，确保前端可以正确解析
    const processedReservationData = {
      startDateTime: processTimestamp(reservationData.startDateTime),
      endDateTime: processTimestamp(reservationData.endDateTime),
      roomType: reservationData.roomType || null,
      userFullName: userFullName || null,
      userName: reservationData.userName || null,
      slowRoomAsSetPlan: reservationData.slowRoomAsSetPlan || false,
      slowRoomStartDateTime: processTimestamp(
        reservationData.slowRoomStartDateTime
      ),
      slowRoomEndDateTime: processTimestamp(
        reservationData.slowRoomEndDateTime
      ),
    };

    // 返回详细结果
    return NextResponse.json({
      success: true,
      reservationId,
      reservationData: processedReservationData,
      cards: cards,
    });
  } catch (error) {
    console.error("ユーザーカード情報取得エラー:", error);
    return NextResponse.json(
      {
        error: "予約とカード情報の取得中にエラーが発生しました",
        success: false,
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
