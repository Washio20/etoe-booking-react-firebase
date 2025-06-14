import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
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
    console.log("Webhook: 开始发送预约确认邮件...");
    
    // 检查必要的环境变量
    const requiredEnvVars = [
      'GMAIL_CLIENT_ID',
      'GMAIL_CLIENT_SECRET', 
      'GMAIL_REDIRECT_URI',
      'GMAIL_REFRESH_TOKEN'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`缺少Gmail环境变量: ${missingVars.join(', ')}`);
    }
    
    console.log("Webhook: Gmail环境变量检查通过");
    console.log("Webhook: CLIENT_ID前缀:", process.env.GMAIL_CLIENT_ID?.substring(0, 20) + "...");
    console.log("Webhook: REFRESH_TOKEN前缀:", process.env.GMAIL_REFRESH_TOKEN?.substring(0, 20) + "...");

    // 获取授权客户端
    try {
      // 获取新的访问令牌
      const { credentials } = await oAuth2Client.refreshAccessToken();
      console.log("Webhook: 成功获取访问令牌");
      
      // 设置访问令牌
      oAuth2Client.setCredentials(credentials);
      
    } catch (authError: any) {
      console.error("Webhook: OAuth2认证失败:", authError.message);
      throw new Error(`Gmail认证失败: ${authError.message}`);
    }

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // 邮件主题
    const subject = "【etoe sauna & stay】ご予約ありがとうございます";
    
    // 手动使用RFC2047标准编码邮件标题
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;

    // 网站基础URL - 使用环境变量或固定值
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    // 预约详情链接
    const reservationDetailsUrl = `${baseUrl}/reservations`;

    // 格式化房间类型显示
    const roomTypeDisplay = (reservation.roomType || "").replace(/_/g, " ");
    
    // 创建纯文本邮件内容，包含预约详情
    let textContent = `
${subject}

${userName} 様

etoe sauna & stayをご予約いただき、誠にありがとうございます。
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

    // 添加优惠券折扣信息（如果有）
    if (reservation.discountBreakdown && reservation.discountBreakdown.totalDiscount > 0) {
      textContent += `
割引詳細:
`;
      if (reservation.discountBreakdown.roomDiscount > 0) {
        textContent += `• ${getRoomTypeDisplayName(reservation.roomType)}: -${reservation.discountBreakdown.roomDiscount.toLocaleString()}円
`;
      }
      if (reservation.discountBreakdown.slowRoomDiscount > 0) {
        textContent += `• スロールーム: -${reservation.discountBreakdown.slowRoomDiscount.toLocaleString()}円
`;
      }
      textContent += `クーポン割引合計: -${reservation.discountBreakdown.totalDiscount.toLocaleString()}円
`;
    }

    textContent += `
料金: ${Number(reservation.price || 0).toLocaleString()}円

予約の詳細はこちらから確認できます:
${reservationDetailsUrl}

ご予約の前日までに、入室パスコードをお送りいたします。
ご予約の変更やキャンセルは、マイページからお手続きいただけます。

その他ご不明な点がございましたら、お気軽にお問い合わせください。
お客様のご来館を心よりお待ちしております。

etoe hotel
Email: info@etoehotel.com
`;

    console.log("Webhook: 邮件内容准备完成");
    console.log("Webhook: 收件人:", to);
    console.log("Webhook: 发件人:", EMAIL_FROM);

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

    console.log("Webhook: 开始发送邮件...");

    // 发送邮件
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
      },
    });

    console.log("Webhook: 预约确认邮件发送成功");
    console.log("Webhook: 邮件ID:", res.data.id);
    console.log("Webhook: 线程ID:", res.data.threadId);
    
    return res.data;
  } catch (error: any) {
    console.error("Webhook: 使用Gmail API发送预约确认邮件失败");
    console.error("Webhook: 错误类型:", error.constructor.name);
    console.error("Webhook: 错误消息:", error.message);
    
    if (error.response) {
      console.error("Webhook: HTTP状态:", error.response.status);
      console.error("Webhook: 响应数据:", JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.code) {
      console.error("Webhook: 错误代码:", error.code);
    }
    
    throw error;
  }
}

// 获取房间类型显示名称
function getRoomTypeDisplayName(roomType: string): string {
  switch (roomType) {
    case 'tototo': return 'TOTOTO';
    case 'fuuu': return 'FUUU';
    case 'zabuun': return 'ZABUUN';
    case 'toron': return 'TORON';
    case 'sauna_suite': return 'サウナスイート';
    case 'slow_room': return 'スロールーム';
    default: return roomType;
  }
}

// 处理预约成功的逻辑
async function handleReservationSuccess(session: Stripe.Checkout.Session): Promise<string | null> {
  try {
    // 初始化Firebase Admin
    initAdmin();
    const db = getFirestore();
    
    // 获取用户信息
    const userId = session.metadata?.userId;
    if (!userId) {
      console.error("Webhook: 没有找到用户ID");
      return null;
    }

    // 获取用户详情
    const userRecord = await getAuth().getUser(userId);

    // 首先检查是否已经存在使用相同session ID的预约，避免重复创建
    const existingReservationsQuery = await db
      .collection("reservations")
      .where("paymentId", "==", session.id)
      .get();

    // 如果已存在预约，直接返回该预约的ID
    if (!existingReservationsQuery.empty) {
      const existingReservation = existingReservationsQuery.docs[0];
      console.log(`Webhook: 找到现有预约，避免重复创建: ${existingReservation.id}`);
      return existingReservation.id;
    }

    // 从元数据中提取slow room相关信息
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

    console.log("Webhook: 预约元数据:", session.metadata);
    console.log("Webhook: needSlowRoom值:", needSlowRoomValue, "类型:", typeof needSlowRoomValue);
    console.log("Webhook: roomType值:", session.metadata?.roomType);
    console.log("Webhook: slowRoomAsSetPlan设置为:", slowRoomAsSetPlan);

    // 如果是套餐预约，添加slow room时间信息
    if (slowRoomAsSetPlan && session.metadata?.slowRoomTimeRange) {
      try {
        const slowRoomData = JSON.parse(session.metadata.slowRoomTimeRange);
        slowRoomStartTime = slowRoomData.startTime;
        slowRoomEndTime = slowRoomData.endTime;
        slowRoomTime = `${slowRoomStartTime}〜${slowRoomEndTime}`;
        console.log("Webhook: Slow Room 时间范围:", slowRoomTime);
      } catch (e) {
        console.error("Webhook: 无法解析slow room时间范围:", e);
      }
    }

    // 解析折扣详情
    let discountBreakdown = null;
    if (session.metadata?.discountBreakdown) {
      try {
        discountBreakdown = JSON.parse(session.metadata.discountBreakdown);
        console.log("Webhook: 解析到折扣详情:", discountBreakdown);
      } catch (e) {
        console.error("Webhook: 无法解析折扣详情:", e);
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
      const timeRangeParts = session.metadata.reservationTime.split(/[～〜\-~]/);

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
          console.log(`Webhook: 设置startDateTime: ${startDate.toISOString()}`);

          // 创建结束时间对象
          const endDate = new Date(bookingDate);
          endDate.setHours(endTime.hour, endTime.minute, 0, 0);
          endDateTime = admin.firestore.Timestamp.fromDate(endDate);
          console.log(`Webhook: 设置endDateTime: ${endDate.toISOString()}`);
        } else {
          console.error("Webhook: 无法解析时间字符串:", startTimeStr, endTimeStr);
        }
      } else {
        console.error("Webhook: 时间范围格式不正确:", session.metadata.reservationTime);
      }
    }

    // 解析慢房间时间（如果有）
    let slowRoomStartDateTime: admin.firestore.Timestamp | null = null;
    let slowRoomEndDateTime: admin.firestore.Timestamp | null = null;

    if (slowRoomAsSetPlan && slowRoomStartTime && slowRoomEndTime && bookingDate) {
      const slowStartTime = parseTimeString(slowRoomStartTime);
      const slowEndTime = parseTimeString(slowRoomEndTime);

      if (slowStartTime && slowEndTime) {
        // 创建慢房间开始时间
        const slowStartDate = new Date(bookingDate);
        slowStartDate.setHours(slowStartTime.hour, slowStartTime.minute, 0, 0);
        slowRoomStartDateTime = admin.firestore.Timestamp.fromDate(slowStartDate);

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
    const reservationData: any = {
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

      // 优惠券相关信息
      couponId: session.metadata?.couponId || null,
      discountAmount: session.metadata?.discountAmount 
        ? parseInt(session.metadata.discountAmount) 
        : 0,

      // 标记此预约通过webhook创建
      createdViaWebhook: true,
    };

    // 如果有折扣详情，添加到预约记录中
    if (discountBreakdown) {
      reservationData.discountBreakdown = discountBreakdown;
    }

    const reservationRef = await db.collection("reservations").add(reservationData);

    // 如果应用了优惠券，更新优惠券使用记录
    if (session.metadata?.couponId) {
      // 获取预约ID
      const reservationId = reservationRef.id;
      
      // 更新之前创建的优惠券使用记录，添加预约ID
      const couponUsageQuery = await db
        .collection("couponUsage")
        .where("couponId", "==", session.metadata.couponId)
        .where("userId", "==", userRecord.uid)
        .where("status", "==", "pending")
        .orderBy("usedAt", "desc")
        .limit(1)
        .get();
      
      if (!couponUsageQuery.empty) {
        const updateData: any = {
          reservationId: reservationId,
          status: "completed", // 更新状态为已完成
          updatedAt: admin.firestore.Timestamp.now()
        };

        // 如果有折扣详情，也更新到使用记录中
        if (discountBreakdown) {
          updateData.discountBreakdown = discountBreakdown;
        }

        await couponUsageQuery.docs[0].ref.update(updateData);
        
        // 增加优惠券使用次数
        await db.collection("coupons").doc(session.metadata.couponId).update({
          usedCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.Timestamp.now()
        });
        
        console.log(`Webhook: 优惠券(${session.metadata.couponId})使用记录已更新为completed状态，使用次数已增加`);
      }
    }

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
            discountBreakdown: discountBreakdown, // 添加折扣详情
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

        console.log(`Webhook: 预约确认邮件已发送至 ${userRecord.email}`);
      } else {
        // 测试模式 - 只记录邮件内容但不实际发送
        console.log("Webhook: 测试模式 - 不发送实际邮件");
      }
    } catch (error) {
      console.error("Webhook: 发送预约确认邮件时出错:", error);
      // 发送邮件失败不影响预约流程
    }

    console.log(`Webhook: 预约创建成功，ID: ${reservationId}`);
    return reservationId;

  } catch (error) {
    console.error("Webhook: 处理预约成功时出错:", error);
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = headers().get("stripe-signature");

  // 在函数内部初始化 Stripe
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-03-31.basil",
  });
  
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
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
        if (metadata && session.payment_status === "paid") {
          console.log("Webhook: 开始处理支付成功的预约:", metadata);
          
          // 处理预约成功的逻辑
          const reservationId = await handleReservationSuccess(session);
          
          if (reservationId) {
            console.log(`Webhook: 预约处理成功，预约ID: ${reservationId}`);
          } else {
            console.error("Webhook: 预约处理失败");
          }
        } else {
          console.log("Webhook: 支付未完成或缺少元数据，跳过处理");
        }
        break;

      case "checkout.session.expired":
        // 处理支付会话过期的情况
        console.log("Webhook: 支付会话过期:", event.data.object);
        break;

      default:
        console.log(`Webhook: 未处理的事件类型: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook: 处理webhook时出错:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";