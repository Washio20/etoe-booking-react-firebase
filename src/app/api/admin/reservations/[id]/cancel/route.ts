import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import Stripe from "stripe";

// 确保Firebase Admin已初始化
initAdmin();

// 初始化Stripe客户端
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-03-31.basil",
});

// 取消预约
export async function POST(
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

    // 获取并更新预约
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

    const reservationData = reservationDoc.data();

    // 检查是否已经取消
    if (reservationData?.paymentStatus === "cancelled") {
      return NextResponse.json(
        { error: "この予約はすでにキャンセルされています" },
        { status: 400 }
      );
    }

    // 获取请求体数据，管理员可以选择退款比例（默认全额退款）
    let refundPercentage = 100; // 默认全额退款
    try {
      const requestData = await request.json();
      if (requestData && typeof requestData.refundPercentage === "number") {
        refundPercentage = Math.min(
          100,
          Math.max(0, requestData.refundPercentage)
        );
      }
    } catch (e) {
      // 忽略解析错误，使用默认值
    }

    // 获取Stripe支付ID（在完成支付时保存）
    const paymentId = reservationData?.paymentId;

    // 如果存在支付ID，则进行退款处理
    let refundId = null;
    let refundAmount = 0;

    if (paymentId) {
      try {
        // 获取支付信息
        const session = await stripe.checkout.sessions.retrieve(paymentId);

        // 计算退款金额（根据指定的退款比例）
        const originalAmount = session.amount_total || 0;
        refundAmount = Math.floor(originalAmount * (refundPercentage / 100));

        if (refundAmount > 0 && session.payment_intent) {
          // 创建退款
          const refund = await stripe.refunds.create({
            payment_intent: session.payment_intent as string,
            amount: refundAmount,
            reason: "requested_by_customer",
          });

          refundId = refund.id;
        }
      } catch (stripeError) {
        console.error("Stripe refund error:", stripeError);
        // 即使Stripe退款失败，我们仍然继续取消预约，但记录错误
      }
    }

    // 执行取消操作
    await db
      .collection("reservations")
      .doc(reservationId)
      .update({
        paymentStatus: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: {
          uid: decodedToken.uid,
          email: userRecord.email,
          type: "admin",
        },
        // 添加退款相关信息
        refund: refundId
          ? {
              id: refundId,
              amount: refundAmount,
              percentage: refundPercentage,
              createdAt: new Date(),
              status: "processed",
              processedBy: {
                uid: decodedToken.uid,
                email: userRecord.email,
              },
            }
          : null,
      });

    return NextResponse.json({
      success: true,
      message: "予約がキャンセルされました",
      refund: refundId
        ? {
            id: refundId,
            amount: refundAmount / 100, // 转换为元
            percentage: refundPercentage,
          }
        : null,
    });
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    return NextResponse.json(
      { error: "予約のキャンセル中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
