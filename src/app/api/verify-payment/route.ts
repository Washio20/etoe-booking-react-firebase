import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";
import { google } from "googleapis";

export async function GET(req: Request) {
  // 初始化Firebase Admin
  try {
    initAdmin();
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
  }
  
  // 初始化Stripe客户端
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-03-31.basil",
  });
  
  // 初始化Firestore
  const db = getFirestore();
  
  try {
    // 获取URL和会话ID
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "セッションIDが必要です" },
        { status: 400 }
      );
    }

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

    // 获取用户详情
    const userRecord = await getAuth().getUser(decodedToken.uid);

    // 检查Stripe会话状态
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // 检查会话是否完成
      if (session.payment_status !== "paid") {
        return NextResponse.json(
          { error: "支払いが完了していません", status: session.payment_status },
          { status: 400 }
        );
      }

      // 检查用户ID是否匹配
      if (session.metadata?.userId !== userRecord.uid) {
        console.warn(
          `User ID mismatch: ${session.metadata?.userId} vs ${userRecord.uid}`
        );
      }

      // 查询预约是否已存在（完全信任webhook处理）
      const existingReservation = await db
        .collection("reservations")
        .where("paymentId", "==", session.id)
        .get();

      if (!existingReservation.empty) {
        const reservationDoc = existingReservation.docs[0];
        const reservationData = reservationDoc.data();
        
        console.log(`找到现有预约: ${reservationDoc.id}`);
        
        // 检查现有预约是否是通过webhook创建的
        if (reservationData.createdViaWebhook) {
          console.log("预约已通过webhook创建（正常路径）");
        } else {
          console.log("预约通过其他方式创建");
        }
        
        return NextResponse.json({
          success: true,
          message: "予約が見つかりました",
          reservationId: reservationDoc.id,
        });
      }

      // 如果没有找到预约，返回等待状态（不创建预约）
      console.log("未找到预约记录，webhook可能仍在处理中");
      
      return NextResponse.json({
        success: false,
        processing: true,
        message: "予約処理中です。webhookによる処理を待っています...",
      });
    } catch (error) {
      console.error("Error retrieving checkout session:", error);
      return NextResponse.json(
        { error: "支払い情報の取得に失敗しました" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { error: "支払い確認中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";