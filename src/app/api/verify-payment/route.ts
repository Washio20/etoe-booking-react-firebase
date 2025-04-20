import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";

// 确保Firebase Admin已初始化
initAdmin();

// 初始化Stripe客户端
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-03-31.basil",
});

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

export async function GET(req: Request) {
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

      // 记录预约信息，便于调试
      console.log("Creating reservation with metadata:", {
        userId: userRecord.uid,
        email: userRecord.email,
        date: session.metadata?.reservationDate,
        time: session.metadata?.reservationTime,
        roomType: session.metadata?.roomType,
        plan: session.metadata?.plan,
        price: session.metadata?.price,
      });

      // 将预约信息保存到数据库
      const db = getFirestore();

      // 首先检查是否已经存在使用相同session ID的预约
      const existingReservationsQuery = await db
        .collection("reservations")
        .where("paymentId", "==", session.id)
        .get();

      // 如果已存在预约，直接返回该预约的ID
      if (!existingReservationsQuery.empty) {
        const existingReservation = existingReservationsQuery.docs[0];
        console.log(`找到现有预约，避免重复创建: ${existingReservation.id}`);
        return NextResponse.json({
          success: true,
          message: "既存の予約が見つかりました",
          reservationId: existingReservation.id,
        });
      }

      // 从元数据中提取slow room相关信息
      // 将needSlowRoom转换为布尔值
      const needSlowRoomValue = session.metadata?.needSlowRoom;
      let slowRoomAsSetPlan = false;

      // 使用String()转换后比较，避免类型问题
      if (String(needSlowRoomValue).toLowerCase() === "true") {
        // 只有纯sauna房间才能以套餐方式使用slow room
        const roomType = session.metadata?.roomType || "";
        slowRoomAsSetPlan =
          String(needSlowRoomValue).toLowerCase() === "true" &&
          isPureSaunaRoom(roomType);
      }

      let slowRoomStartTime = null;
      let slowRoomEndTime = null;
      let slowRoomTime = null;

      console.log("预约元数据:", session.metadata);
      console.log(
        "needSlowRoom值:",
        needSlowRoomValue,
        "类型:",
        typeof needSlowRoomValue
      );
      console.log("roomType值:", session.metadata?.roomType);
      console.log("slowRoomAsSetPlan设置为:", slowRoomAsSetPlan);

      // 如果是套餐预约，添加slow room时间信息
      if (slowRoomAsSetPlan && session.metadata?.slowRoomTimeRange) {
        try {
          const slowRoomData = JSON.parse(session.metadata.slowRoomTimeRange);
          slowRoomStartTime = slowRoomData.startTime;
          slowRoomEndTime = slowRoomData.endTime;
          slowRoomTime = `${slowRoomStartTime}〜${slowRoomEndTime}`;
          console.log("Slow Room 时间范围:", slowRoomTime);
        } catch (e) {
          console.error("无法解析slow room时间范围:", e);
        }
      }

      // 创建Timestamp
      const now = admin.firestore.Timestamp.now();

      // 解析预约日期
      const bookingDate = parseJapaneseDate(session.metadata?.reservationDate);

      // 初始化开始和结束日期时间
      let startDateTime: admin.firestore.Timestamp | null = null;
      let endDateTime: admin.firestore.Timestamp | null = null;

      // 如果有预约日期和时间，解析时间
      if (bookingDate && session.metadata?.reservationTime) {
        // 使用正则表达式匹配多种可能的分隔符 (～, 〜, -, ~)
        const timeRangeParts =
          session.metadata.reservationTime.split(/[～〜\-~]/);

        if (timeRangeParts.length === 2) {
          const startTimeStr = timeRangeParts[0].trim();
          const endTimeStr = timeRangeParts[1].trim();

          const startTime = parseTimeString(startTimeStr);
          const endTime = parseTimeString(endTimeStr);

          if (startTime && endTime) {
            // 创建开始时间对象
            const startDate = new Date(bookingDate);
            startDate.setHours(startTime.hour, startTime.minute, 0, 0);
            startDateTime = admin.firestore.Timestamp.fromDate(startDate);
            console.log(`设置startDateTime: ${startDate.toISOString()}`);

            // 创建结束时间对象
            const endDate = new Date(bookingDate);
            endDate.setHours(endTime.hour, endTime.minute, 0, 0);
            endDateTime = admin.firestore.Timestamp.fromDate(endDate);
            console.log(`设置endDateTime: ${endDate.toISOString()}`);
          } else {
            console.error("无法解析时间字符串:", startTimeStr, endTimeStr);
          }
        } else {
          console.error(
            "时间范围格式不正确:",
            session.metadata.reservationTime
          );
        }
      }

      // 解析慢房间时间（如果有）
      let slowRoomStartDateTime: admin.firestore.Timestamp | null = null;
      let slowRoomEndDateTime: admin.firestore.Timestamp | null = null;

      if (
        slowRoomAsSetPlan &&
        slowRoomStartTime &&
        slowRoomEndTime &&
        bookingDate
      ) {
        const slowStartTime = parseTimeString(slowRoomStartTime);
        const slowEndTime = parseTimeString(slowRoomEndTime);

        if (slowStartTime && slowEndTime) {
          // 创建慢房间开始时间
          const slowStartDate = new Date(bookingDate);
          slowStartDate.setHours(
            slowStartTime.hour,
            slowStartTime.minute,
            0,
            0
          );
          slowRoomStartDateTime =
            admin.firestore.Timestamp.fromDate(slowStartDate);

          // 创建慢房间结束时间
          const slowEndDate = new Date(bookingDate);
          slowEndDate.setHours(slowEndTime.hour, slowEndTime.minute, 0, 0);
          slowRoomEndDateTime = admin.firestore.Timestamp.fromDate(slowEndDate);
        }
      }

      // 转换价格为数字
      const priceNumber = session.metadata?.price
        ? parseInt(session.metadata.price.replace(/,/g, ""))
        : 0;

      // 创建预约记录
      const reservationRef = await db.collection("reservations").add({
        // 用户信息
        userId: userRecord.uid,
        userEmail: userRecord.email,

        // 房间信息
        roomType: session.metadata?.roomType,

        // 时间信息 - 使用Timestamp
        bookingDate: bookingDate
          ? admin.firestore.Timestamp.fromDate(bookingDate)
          : null,
        startDateTime: startDateTime,
        endDateTime: endDateTime,

        // Slow room相关
        slowRoomAsSetPlan: slowRoomAsSetPlan,
        slowRoomStartDateTime: slowRoomStartDateTime,
        slowRoomEndDateTime: slowRoomEndDateTime,

        // 支付信息
        price: priceNumber,
        paymentStatus: session.payment_status,
        paymentId: session.id,

        // 元数据
        createdAt: now,
        updatedAt: now,

        // UI显示格式 (用于向后兼容)
        displayDate: session.metadata?.reservationDate,
        displayTimeRange: session.metadata?.reservationTime,
        displaySlowRoomTimeRange: slowRoomTime,

        // 保留原字段用于向后兼容
        // reservationDate: session.metadata?.reservationDate,
        // reservationTime: session.metadata?.reservationTime,
        // plan: session.metadata?.plan,
        // slowRoomTime: slowRoomTime,
        // slowRoomStartTime: slowRoomStartTime,
        // slowRoomEndTime: slowRoomEndTime,
      });

      const reservationId = reservationRef.id;

      // 返回结果
      return NextResponse.json({
        success: true,
        message: "支払いが確認されました",
        reservationId,
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
