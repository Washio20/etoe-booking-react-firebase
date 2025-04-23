import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";
import { getStripe } from "@/utils/stripe";

// 确保Firebase Admin已初始化
initAdmin();

// 初始化Stripe客户端
const stripe = getStripe();

// 是否为纯sauna房间
const isPureSaunaRoom = (roomType: string): boolean => {
  return ["tototo", "fuuu", "zabuun", "toron"].includes(roomType);
};

// 解析日期字符串（格式：YYYY年MM月DD日）
function parseJapaneseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;

  const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [_, year, month, day] = match;
  // 创建日期对象 (月份需要减1，因为JavaScript中月份是从0开始的)
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    0,
    0,
    0,
    0
  );
}

// 解析时间字符串（格式：HH:MM）
function parseTimeString(
  timeStr?: string
): { hour: number; minute: number } | null {
  if (!timeStr) return null;

  const match = timeStr.match(/(\d+):(\d+)/);
  if (!match) return null;

  return {
    hour: parseInt(match[1]),
    minute: parseInt(match[2]),
  };
}

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 处理验证支付的POST请求
export async function POST(req: Request) {
  try {
    if (!stripe) {
      console.error("Stripe not initialized");
      return NextResponse.json(
        { error: "支払いシステムの設定エラー" },
        { status: 500 }
      );
    }
    
    // 获取会话ID
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "セッションIDが必要です" },
        { status: 400 }
      );
    }

    // 获取Stripe会话以验证支付状态
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.status !== "complete") {
      return NextResponse.json(
        { error: "支払いが完了していません" },
        { status: 400 }
      );
    }

    // 检查付款是否已经处理过
    const db = getFirestore();
    const reservationsRef = db.collection("reservations");
    const existingReservation = await reservationsRef
      .where("paymentId", "==", sessionId)
      .get();

    if (!existingReservation.empty) {
      // 可能已经处理过此付款，返回预约信息
      const reservationData = existingReservation.docs[0].data();
      return NextResponse.json({
        success: true,
        reservation: {
          id: existingReservation.docs[0].id,
          ...reservationData,
        },
        message: "この支払いはすでに処理されています",
      });
    }

    // 从会话的metadata中获取预约信息
    const metadata = session.metadata || {};
    const userId = metadata.userId;
    const reservationDate = metadata.reservationDate;
    const reservationTime = metadata.reservationTime;
    const roomType = metadata.roomType;
    const plan = metadata.plan;
    const price = parseInt(metadata.price || "0");
    const needSlowRoom = metadata.needSlowRoom === "true";
    const isPureSaunaRoomValue = metadata.isPureSaunaRoom === "true";
    let slowRoomTimeRange = null;

    if (metadata.slowRoomTimeRange) {
      try {
        slowRoomTimeRange = JSON.parse(metadata.slowRoomTimeRange);
      } catch (e) {
        // 如果不是有效的JSON，直接使用字符串
        slowRoomTimeRange = metadata.slowRoomTimeRange;
      }
    }

    // 保存预约信息到Firestore
    const newReservation = {
      userId: userId,
      date: reservationDate,
      time: reservationTime,
      roomType: roomType,
      plan: plan,
      price: price,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentId: sessionId,
      paymentStatus: "completed",
      status: "confirmed", // 预约状态：confirmed, checked_in, completed, cancelled
      needSlowRoom: needSlowRoom,
      slowRoomTimeRange: slowRoomTimeRange,
      isPureSaunaRoom: isPureSaunaRoomValue,
    };

    // 添加预约记录
    const reservationDocRef = await reservationsRef.add(newReservation);

    return NextResponse.json({
      success: true,
      reservation: {
        id: reservationDocRef.id,
        ...newReservation,
      },
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { error: "支払いの確認中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";
