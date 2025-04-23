import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/utils/stripe";

// 条件初始化Stripe
const stripe = getStripe();

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  // 检查Stripe是否初始化
  if (!stripe) {
    console.error("Stripe not initialized");
    return new Response("Configuration error", { status: 500 });
  }

  const body = await req.text();
  const sig = headers().get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (!sig || !endpointSecret) {
      throw new Error("Missing stripe-signature or endpoint secret");
    }

    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    // 处理特定的事件类型
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session;

        // 获取预约信息从session的metadata
        const metadata = session.metadata;
        if (metadata) {
          // TODO: 在这里处理预约成功的逻辑
          // 1. 保存预约记录到数据库
          // 2. 发送确认邮件
          // 3. 更新预约状态等
          console.log("Payment successful for reservation:", metadata);
        }
        break;

      case "checkout.session.expired":
        // 处理支付会话过期的情况
        console.log("Payment session expired:", event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
