import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { NextRequest } from "next/server";
import admin from "firebase-admin";
import { Coupon } from "@/types/coupon";

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

export async function POST(req: Request) {
  // 设置时区为日本时区
  process.env.TZ = "Asia/Tokyo";
  
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
    let appliedCouponId = reservation.couponId || null;
    let discountAmount = reservation.discountAmount || 0;
    let skipCouponProcessing = false;

    // 如果前端已经提供了金额和折扣信息，跳过重复处理
    if (amount !== undefined && reservation.couponId && reservation.discountAmount) {
      console.log("使用前端提供的金额和折扣信息: ", {
        amount: amount,
        couponId: reservation.couponId,
        discountAmount: reservation.discountAmount
      });
      skipCouponProcessing = true;
    }

    // 如果没有提供金额，则计算价格
    if (amount === undefined) {

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

    // 添加优惠券处理
    if (!skipCouponProcessing && reservation.couponId) {
      try {
        // 获取优惠券信息
        const couponDoc = await db.collection("coupons").doc(reservation.couponId).get();
        
        if (couponDoc.exists) {
          const coupon = couponDoc.data() as Coupon;
          
          // 验证优惠券是否有效
          const now = admin.firestore.Timestamp.now();
          const isValid = coupon.isActive && 
                          coupon.validFrom <= now && 
                          coupon.validTo >= now &&
                          (coupon.usageLimit === -1 || coupon.usedCount < coupon.usageLimit);
          
          if (isValid) {
            // 验证是否适用于当前房型
            const isApplicable = coupon.applicableRoomTypes.length === 0 || 
                                coupon.applicableRoomTypes.includes(reservation.roomType);
            
            if (isApplicable) {
              // 计算折扣金额
              if (coupon.discountType === 'fixed') {
                discountAmount = Math.min(coupon.discountValue, amount);
              } else {
                // 百分比折扣
                discountAmount = Math.floor(amount * (coupon.discountValue / 100));
                if (coupon.maxDiscount && coupon.maxDiscount > 0) {
                  discountAmount = Math.min(discountAmount, coupon.maxDiscount);
                }
              }
              
              // 应用折扣
              amount -= discountAmount;
              appliedCouponId = reservation.couponId;
              
              // 移除优惠券使用记录更新，将在后面统一处理
            }
          }
        }
      } catch (error) {
        console.error("优惠券处理错误:", error);
        // 优惠券处理失败时，不应用折扣，但继续处理预约
        appliedCouponId = null;
        discountAmount = 0;
      }
    }

    // 确保金额不小于零
    amount = Math.max(0, amount);
    
    // 记录最终金额，用于调试
    console.log(`最终计算金额: ${amount}円，优惠券折扣: ${discountAmount}円`);

    // 无论是否重新计算价格，只要有优惠券ID，都更新使用次数和创建记录
    if (appliedCouponId) {
      try {
        const now = admin.firestore.Timestamp.now();
        
        // 移除优惠券使用次数更新逻辑，只有在支付成功后才更新使用次数
        // await db.collection("coupons").doc(appliedCouponId).update({
        //   usedCount: admin.firestore.FieldValue.increment(1),
        //   updatedAt: now
        // });
        
        // 创建优惠券使用记录，添加status字段
        await db.collection("couponUsage").add({
          couponId: appliedCouponId,
          userId: userRecord.uid,
          reservationId: null, // 此时还没有预约ID
          discountAmount: discountAmount,
          originalAmount: amount + discountAmount,
          finalAmount: amount,
          usedAt: now,
          status: "pending" // 添加状态字段，初始状态为pending
        });
        
        console.log(`已创建优惠券(${appliedCouponId})使用记录，状态为pending`);
      } catch (error) {
        console.error("创建优惠券使用记录失败:", error);
        // 创建记录失败不应影响支付流程，继续执行
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
        couponId: appliedCouponId || "", // 添加优惠券ID
        discountAmount: String(discountAmount), // 添加折扣金额
        originalAmount: String(amount + discountAmount), // 添加原始金额
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