import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";
import { google } from "googleapis";

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

// OAuth2 客户端配置
const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// 配置邮件发送
const EMAIL_FROM = process.env.EMAIL_FROM 
  ? (process.env.EMAIL_FROM.includes('<') ? process.env.EMAIL_FROM : `etoe hotel <${process.env.EMAIL_FROM}>`)
  : "etoe hotel <no-reply@etoehotel.com>";

// 使用测试模式（不发送实际邮件）
const USE_TEST_MODE = false;

// 设置刷新令牌
oAuth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

// 使用Gmail API发送预约确认邮件
async function sendReservationConfirmationEmail(
  to: string,
  userName: string,
  reservation: any
): Promise<any> {
  try {
    // 获取授权客户端
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // 邮件主题
    const subject = "【etoe hotel】ご予約ありがとうございます";
    
    // 手动使用RFC2047标准编码邮件标题
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;

    // 网站基础URL - 使用环境变量或固定值
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://etoehotel.com";

    // 预约详情链接
    const reservationDetailsUrl = `${baseUrl}/reservations`;

    // 格式化房间类型显示
    const roomTypeDisplay = (reservation.roomType || "").replace(/_/g, " ");
    
    // 创建纯文本邮件内容，包含预约详情
    let textContent = `
${subject}

${userName} 様

etoe hotelをご予約いただき、誠にありがとうございます。
以下の予約内容で承りました。

=== ご予約内容 ===

予約日: ${reservation.displayDate || reservation.reservationDate || ""}
時間: ${reservation.displayTimeRange || reservation.reservationTime || ""}
部屋タイプ: ${roomTypeDisplay}
`;

    // 如果有慢房间套餐，添加慢房间信息
    if (reservation.slowRoomAsSetPlan && reservation.displaySlowRoomTimeRange) {
      textContent += `
スロールーム: ${reservation.displaySlowRoomTimeRange}
`;
    }

    textContent += `
料金: ${Number(reservation.price || 0).toLocaleString()}円

予約の詳細はこちらから確認できます:
${reservationDetailsUrl}

ご来館の際は、フロントにてお名前をお伝えください。
ご予約の変更やキャンセルは、マイページからお手続きいただけます。

その他ご不明な点がございましたら、お気軽にお問い合わせください。
お客様のご来館を心よりお待ちしております。

etoe hotel
Email: info@etoehotel.com
`;

    // 使用纯文本内容
    const message = [
      `From: ${EMAIL_FROM}`,
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      textContent,
    ].join("\r\n");

    // 将邮件内容转为Base64URL编码
    const encodedEmail = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // 发送邮件
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
      },
    });

    console.log("预约确认邮件发送成功:", res.data);
    return res.data;
  } catch (error) {
    console.error("使用Gmail API发送预约确认邮件失败:", error);
    throw error;
  }
}

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

      // 发送预约确认邮件
      try {
        // 获取用户详细信息
        const userDoc = await db.collection("users").doc(userRecord.uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const userFullName = userData?.fullName || userRecord.displayName || "お客様";
        
        if (!USE_TEST_MODE) {
          await sendReservationConfirmationEmail(
            userRecord.email || "",
            userFullName,
            {
              userId: userRecord.uid,
              userEmail: userRecord.email,
              roomType: session.metadata?.roomType,
              displayDate: session.metadata?.reservationDate,
              displayTimeRange: session.metadata?.reservationTime,
              displaySlowRoomTimeRange: slowRoomTime,
              price: priceNumber,
              paymentStatus: session.payment_status,
              paymentId: session.id,
              slowRoomAsSetPlan: slowRoomAsSetPlan,
              userFullName: userFullName,
            }
          );

          // 更新预约记录，标记邮件已发送
          await db
            .collection("reservations")
            .doc(reservationId)
            .update({
              confirmationEmailSent: true,
              confirmationEmailSentAt: admin.firestore.Timestamp.now(),
              updatedAt: admin.firestore.Timestamp.now(),
            });

          console.log(`预约确认邮件已发送至 ${userRecord.email}`);
        } else {
          // 测试模式 - 只记录邮件内容但不实际发送
          console.log("测试模式 - 不发送实际邮件");
          console.log("预约确认邮件内容:", {
            to: userRecord.email,
            userName: userFullName,
            reservation: {
              id: reservationId,
              date: session.metadata?.reservationDate,
              time: session.metadata?.reservationTime,
              roomType: session.metadata?.roomType,
              price: session.metadata?.price,
            }
          });
        }
      } catch (error) {
        console.error("发送预约确认邮件时出错:", error);
        // 发送邮件失败不影响预约流程，仍然返回成功
      }

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