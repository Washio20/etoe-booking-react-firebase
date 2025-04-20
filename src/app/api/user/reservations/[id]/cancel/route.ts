import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as admin from "firebase-admin";
import Stripe from "stripe";

// 设置日本时区
process.env.TZ = "Asia/Tokyo";

// 确保Firebase Admin已初始化
initAdmin();

// 初始化Stripe客户端
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-03-31.basil",
});

// 用户取消自己的预约
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

    // 获取用户ID
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email || "";

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

    // 检查预约是否属于当前用户
    if (reservationData?.userId !== userId) {
      return NextResponse.json(
        { error: "この予約をキャンセルする権限がありません" },
        { status: 403 }
      );
    }

    // 检查是否已经取消
    if (reservationData?.paymentStatus === "cancelled") {
      return NextResponse.json(
        { error: "この予約はすでにキャンセルされています" },
        { status: 400 }
      );
    }

    // 获取Stripe支付ID（在完成支付时保存）
    const paymentId = reservationData?.paymentId;

    // 检查是否可以免费取消（预约开始时间前48小时）
    let cancellationFeePercentage = 100; // 默认收取100%取消费

    try {
      // 优先使用startDateTime来确定预约时间
      if (reservationData?.startDateTime) {
        try {
          // 获取预约开始时间
          const reservationDateTime = reservationData.startDateTime.toDate();

          // 使用实际当前时间
          const now = new Date();

          // 输出时间信息以便调试
          console.log(
            `当前时间: ${now.toString()} (${now.getFullYear()}/${
              now.getMonth() + 1
            }/${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()})`
          );
          console.log(
            `预约时间: ${reservationDateTime.toString()} (${reservationDateTime.getFullYear()}/${
              reservationDateTime.getMonth() + 1
            }/${reservationDateTime.getDate()} ${reservationDateTime.getHours()}:${reservationDateTime.getMinutes()}:${reservationDateTime.getSeconds()})`
          );

          // 确保日期时间有效
          if (isNaN(reservationDateTime.getTime())) {
            console.error("无效的预约日期时间，使用默认取消政策");
            cancellationFeePercentage = 100; // 如果日期无效，默认收取100%取消费
          } else {
            // 计算剩余小时数 - 精确到毫秒级别
            const timeDifference =
              reservationDateTime.getTime() - now.getTime();
            const hoursBeforeReservation = timeDifference / (1000 * 60 * 60);

            // 计算更详细的时间差用于日志
            const daysDiff = Math.floor(hoursBeforeReservation / 24);
            const hoursDiff = Math.floor(hoursBeforeReservation % 24);
            const minutesDiff = Math.floor(
              (timeDifference % (1000 * 60 * 60)) / (1000 * 60)
            );
            const secondsDiff = Math.floor(
              (timeDifference % (1000 * 60)) / 1000
            );

            console.log(
              `距离预约还有: ${daysDiff}天 ${hoursDiff}时 ${minutesDiff}分 ${secondsDiff}秒`
            );
            console.log(
              `距离预约还有: ${hoursBeforeReservation.toFixed(2)} 小时`
            );

            // 如果还有48小时以上，免费取消
            if (hoursBeforeReservation >= 48) {
              cancellationFeePercentage = 0;
              console.log("符合免费取消条件");
            } else {
              console.log("不符合免费取消条件，收取100%取消费");
            }
          }
        } catch (error) {
          console.error("计算取消费用时出错:", error);
          cancellationFeePercentage = 100; // 出错时默认收取100%取消费
        }
      }
      // 向后兼容：尝试使用旧结构（已删除的字段，只是为了兼容旧数据）
      else if (
        reservationData?.date &&
        (reservationData.date._seconds || reservationData.reservationDate)
      ) {
        console.warn("使用向后兼容方法计算取消费用");
        // 这里省略旧的计算方法，因为旧字段已被删除
        cancellationFeePercentage = 100; // 默认使用100%取消费
      } else {
        console.error("无法确定预约时间，使用默认取消政策");
        cancellationFeePercentage = 100;
      }
    } catch (error) {
      console.error("计算取消费用时出错:", error);
      cancellationFeePercentage = 100; // 出错时默认收取100%取消费
    }

    // 如果存在支付ID，则进行退款处理
    let refundId = null;
    let refundAmount = 0;

    if (paymentId) {
      try {
        // 获取支付信息
        const session = await stripe.checkout.sessions.retrieve(paymentId);

        // 计算退款金额
        const originalAmount = session.amount_total || 0;
        const refundPercentage = 100 - cancellationFeePercentage; // 退款百分比
        refundAmount = Math.floor(originalAmount * (refundPercentage / 100)); // 根据退款百分比计算

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
        cancelledAt: admin.firestore.Timestamp.now(),
        cancelledBy: {
          uid: userId,
          email: userEmail,
          type: "user",
        },
        // 添加退款相关信息
        refund: refundId
          ? {
              id: refundId,
              amount: refundAmount,
              createdAt: admin.firestore.Timestamp.now(),
              status: "processed",
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
