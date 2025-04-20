import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { NextRequest } from "next/server";

// 确保Firebase Admin已初始化
initAdmin();

// 初始化Stripe客户端
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-03-31.basil",
});

// 纯sauna房间类型列表
const PURE_SAUNA_ROOM_TYPES = ["tototo", "fuuu", "zabuun", "toron"];

// 标准价格配置（可根据实际情况调整）
const ROOM_BASE_PRICES: Record<string, number> = {
  tototo: 8000,
  fuuu: 8500,
  zabuun: 9000,
  toron: 9500,
  sauna_suite: 12000,
  slow_room: 8900,
};

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";

export async function POST(req: Request) {
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

    // 获取用户详情
    const userRecord = await getAuth().getUser(decodedToken.uid);

    // 检查用户邮箱是否已验证
    if (!userRecord.emailVerified) {
      return NextResponse.json(
        { error: "メールアドレスの確認が必要です" },
        { status: 403 }
      );
    }

    // 解析请求体获取预约信息
    const reservation = await req.json();

    // 使用前端传递的金额，如果没有传递才使用默认计算方式
    let amount = reservation.amount;

    // 如果没有提供金额，则计算价格
    if (!amount) {
      console.log("从前端接收到的预约数据:", reservation);

      // 获取房间类型和基础价格
      const roomType = reservation.roomType || "";
      let basePrice = 0;

      // 根据房间类型获取基础价格
      if (ROOM_BASE_PRICES[roomType]) {
        basePrice = ROOM_BASE_PRICES[roomType];
      } else {
        // 兼容旧的房型表示方式
        switch (reservation.room) {
          case "TOTOTO":
            basePrice = ROOM_BASE_PRICES.tototo;
            break;
          case "FUUU":
            basePrice = ROOM_BASE_PRICES.fuuu;
            break;
          case "ZABUUN":
            basePrice = ROOM_BASE_PRICES.zabuun;
            break;
          case "TORON":
            basePrice = ROOM_BASE_PRICES.toron;
            break;
          case "サウナスイート":
            basePrice = ROOM_BASE_PRICES.sauna_suite;
            break;
          case "スロールーム":
            basePrice = ROOM_BASE_PRICES.slow_room;
            break;
          default:
            basePrice = 8000; // 默认价格
        }
      }

      // 初始化总价为基础价格
      amount = basePrice;

      // 检查是否是纯sauna房间类型
      const isPureSaunaRoom = PURE_SAUNA_ROOM_TYPES.includes(roomType);

      // 处理套餐情况
      const needSlowRoom =
        reservation.needSlowRoom === true ||
        String(reservation.needSlowRoom).toLowerCase() === "true";

      // 获取slow room价格信息
      let slowRoomPrice = 0;
      if (needSlowRoom && reservation.slowRoomTimeRange) {
        try {
          // 如果slowRoomTimeRange是字符串，尝试解析
          const slowRoomData =
            typeof reservation.slowRoomTimeRange === "string"
              ? JSON.parse(reservation.slowRoomTimeRange)
              : reservation.slowRoomTimeRange;

          if (slowRoomData && slowRoomData.price) {
            slowRoomPrice = slowRoomData.price;
          } else if (slowRoomData && slowRoomData.hours) {
            // 在预约信息中没有直接提供价格的情况下
            console.error("slowRoomData中没有包含价格信息，但这不应该出现");
            // 使用默认价格（取中间值）
            slowRoomPrice = 7900;
          }
        } catch (e) {
          console.error("解析slow room数据时出错:", e);
          // 如果解析失败，使用默认价格（取中间值）
          slowRoomPrice = 7900;
        }
      }

      // 根据房间类型和套餐计算总价
      if (roomType === "slow_room" || roomType === "sauna_suite") {
        // 如果本身就是slow room或sauna suite，不应用套餐逻辑
        amount = basePrice;
      } else if (isPureSaunaRoom && needSlowRoom) {
        // 纯sauna + slow room套餐，应用1000円折扣
        amount = basePrice + (slowRoomPrice - 1000);
      }

      console.log("价格计算详情:", {
        roomType,
        basePrice,
        isPureSaunaRoom,
        needSlowRoom,
        slowRoomPrice,
        finalAmount: amount,
      });
    }

    console.log(
      `创建支付会话，金额: ${amount}円，房间类型: ${reservation.roomType}`
    );

    // 获取应用基础URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // 解析slow room时间范围（如果有）
    let slowRoomTimeRangeStr = "";
    if (reservation.slowRoomTimeRange) {
      if (typeof reservation.slowRoomTimeRange === "string") {
        slowRoomTimeRangeStr = reservation.slowRoomTimeRange;
      } else {
        slowRoomTimeRangeStr = JSON.stringify(reservation.slowRoomTimeRange);
      }
    }

    // 创建Stripe支付会话
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: `${reservation.room} - ${reservation.date} ${reservation.time}`,
              description: `予約日時: ${reservation.date} ${reservation.time}\nプラン: ${reservation.plan}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/reservation-complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/reservation/confirm`,
      customer_email: userRecord.email,
      metadata: {
        userId: userRecord.uid,
        reservationDate: reservation.date,
        reservationTime: reservation.time,
        roomType: reservation.roomType || reservation.room,
        plan: reservation.plan,
        price: String(amount), // 添加价格到metadata
        needSlowRoom: String(reservation.needSlowRoom), // 将布尔值转换为字符串
        slowRoomTimeRange: slowRoomTimeRangeStr, // 添加slow room时间范围
        isPureSaunaRoom: String(
          PURE_SAUNA_ROOM_TYPES.includes(reservation.roomType)
        ), // 添加是否是纯sauna房间标记
      },
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("支払いセッションの作成中にエラーが発生しました:", error);
    return NextResponse.json(
      { error: "支払いセッションの作成に失敗しました" },
      { status: 500 }
    );
  }
}
