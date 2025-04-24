import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { google } from "googleapis";

// 设置邮件发送相关配置
const EMAIL_FROM = process.env.EMAIL_FROM 
  ? (process.env.EMAIL_FROM.includes('<') ? process.env.EMAIL_FROM : `etoe hotel <${process.env.EMAIL_FROM}>`)
  : "etoe hotel <no-reply@etoehotel.com>";

// 使用测试模式（不发送实际邮件）
const USE_TEST_MODE = false;

// OAuth2 客户端配置
const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// 设置刷新令牌
oAuth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

// 使用Gmail API发送预约取消确认邮件
async function sendCancellationConfirmationEmail(
  to: string,
  userName: string,
  reservation: any,
  cancellationDetails: any
): Promise<any> {
  try {
    // 获取授权客户端
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // 邮件主题
    const subject = "【etoe hotel】ご予約キャンセル確認";
    
    // 手动使用RFC2047标准编码邮件标题
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;

    // 网站基础URL - 使用环境变量或固定值
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://etoehotel.com";

    // 预约详情链接
    const reservationDetailsUrl = `${baseUrl}/reservations`;

    // 格式化房间类型显示
    const roomTypeDisplay = (reservation.roomType || "").replace(/_/g, " ");
    
    // 退款金额
    const refundAmount = cancellationDetails.refundAmount;
    const isFreeCancel = cancellationDetails.isFreeCancel;
    
    // 创建纯文本邮件内容，包含取消详情
    let textContent = `
${subject}

${userName} 様

etoe hotelのご予約キャンセルを承りました。

=== キャンセルされた予約内容 ===

予約日: ${reservation.displayDate || ""}
時間: ${reservation.displayTimeRange || ""}
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

`;

    // 添加退款信息
    if (isFreeCancel && refundAmount > 0) {
      textContent += `
キャンセル料: 0円
返金額: ${Number(refundAmount).toLocaleString()}円

お支払い頂いた金額は全額返金されます。
返金は、お支払いに使用されたクレジットカードに反映されます。
（返金処理には、カード会社によって3~10営業日ほどかかる場合がございます）
`;
    } else if (refundAmount > 0) {
      textContent += `
キャンセル料: ${Number(cancellationDetails.feeAmount).toLocaleString()}円
返金額: ${Number(refundAmount).toLocaleString()}円

返金は、お支払いに使用されたクレジットカードに反映されます。
（返金処理には、カード会社によって3~10営業日ほどかかる場合がございます）
`;
    } else {
      textContent += `
キャンセル料: ${Number(cancellationDetails.totalAmount).toLocaleString()}円
返金額: 0円

予約のキャンセルポリシーに基づき、返金はございません。
`;
    }

    textContent += `
ご予約の詳細はこちらから確認できます:
${reservationDetailsUrl}

その他ご不明な点がございましたら、お気軽にお問い合わせください。
またのご利用をお待ちしております。

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

    console.log("预约取消确认邮件发送成功:", res.data);
    return res.data;
  } catch (error) {
    console.error("使用Gmail API发送预约取消确认邮件失败:", error);
    throw error;
  }
}

// 用户取消自己的预约
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // 设置日本时区
  process.env.TZ = "Asia/Tokyo";
  
  // 初始化Firebase Admin
  try {
    initAdmin();
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
  }
  
  // 初始化Stripe客户端
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2023-10-16" as any,
  });
  
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
    let originalAmount = 0; // 添加变量用于跟踪原始金额

    if (paymentId) {
      try {
        // 获取支付信息
        const session = await stripe.checkout.sessions.retrieve(paymentId);
        console.log("Stripe session retrieved:", {
          id: session.id,
          hasPaymentIntent: !!session.payment_intent,
          paymentIntentType: typeof session.payment_intent,
          originalAmount: session.amount_total
        });

        // 计算退款金额
        originalAmount = session.amount_total || 0; // 保存原始金额
        const refundPercentage = 100 - cancellationFeePercentage; // 退款百分比
        refundAmount = Math.floor(originalAmount * (refundPercentage / 100)); // 根据退款百分比计算

        console.log("Refund calculation:", {
          originalAmount,
          cancellationFeePercentage,
          refundPercentage,
          refundAmount
        });

        // 确保退款金额大于0且存在支付意向
        if (refundAmount > 0) {
          if (!session.payment_intent) {
            throw new Error("No payment_intent found in session");
          }

          // 处理payment_intent字段，可能是字符串ID或对象
          const paymentIntentId = typeof session.payment_intent === 'string' 
            ? session.payment_intent 
            : (session.payment_intent as any).id || session.payment_intent;
          
          console.log("Creating refund with payment_intent:", paymentIntentId);
          
          // 记录更详细的支付会话信息
          console.log("详细支付会话信息:", {
            session_id: session.id,
            payment_status: session.payment_status,
            payment_intent: session.payment_intent,
            amount_total: session.amount_total,
            refund_to_create: refundAmount
          });
          
          try {
            // 创建退款
            const refund = await stripe.refunds.create({
              payment_intent: paymentIntentId,
              amount: refundAmount,
              reason: "requested_by_customer",
            });

            refundId = refund.id;
            console.log("Refund created successfully:", refund.id);
            console.log("退款详情:", {
              id: refund.id,
              amount: refund.amount,
              status: refund.status,
              currency: refund.currency
            });
          } catch (refundError: any) {
            console.error("创建退款时出现错误:", refundError);
            console.error("详细退款错误:", {
              message: refundError.message || "Unknown error",
              code: refundError.code || "unknown",
              type: refundError.type || "unknown",
              raw: refundError.raw || "no raw data"
            });
            throw refundError; // 重新抛出错误以便外层捕获
          }
        } else {
          console.log("No refund needed, amount is 0 or negative:", refundAmount);
        }
      } catch (stripeError: any) {
        console.error("Stripe refund error:", stripeError);
        // 记录详细的错误信息，包括错误代码和消息
        const errorDetails: {
          message: any;
          code: any;
          type: any;
          paymentId: any;
          cancellationFeePercentage: number;
          refundAmount: number;
          raw?: {
            type: string;
            message: string;
            code: string;
            param?: string;
            doc_url?: string;
          };
        } = {
          message: stripeError.message || "Unknown error",
          code: stripeError.code || "unknown",
          type: stripeError.type || "unknown",
          paymentId: paymentId,
          cancellationFeePercentage,
          refundAmount
        };
        
        // 如果有原始Stripe错误对象，记录更多详情
        if (stripeError.raw) {
          errorDetails.raw = {
            type: stripeError.raw.type,
            message: stripeError.raw.message,
            code: stripeError.raw.code,
            param: stripeError.raw.param,
            doc_url: stripeError.raw.doc_url
          };
        }
        
        // 检查是否因为支付意向已经被退款
        const isAlreadyRefunded = 
          stripeError.code === 'charge_already_refunded' || 
          (stripeError.raw && stripeError.raw.code === 'charge_already_refunded') ||
          stripeError.message?.includes('already been refunded') ||
          stripeError.message?.includes('已经退款');
          
        if (isAlreadyRefunded) {
          console.warn("此支付可能已被退款，跳过退款创建", errorDetails);
        } else {
          console.error("Stripe退款错误详情:", errorDetails);
        }
        
        // 我们仍然继续取消预约，但详细记录错误
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

    // 构造更详细的响应信息
    const responseData: {
      success: boolean;
      message: string;
      refund: {
        id: string;
        amount: number;
        currency: string;
      } | null;
      cancellationDetails: {
        feePercentage: number;
        totalAmount: number;
        refundAmount: number;
        feeAmount: number;
        isFreeCancel: boolean;
      };
      refundProcessing?: {
        status: string;
        originalAmount: number;
        message: string;
      };
    } = {
      success: true,
      message: "予約がキャンセルされました",
      // 日本円単位なので、金額はそのまま使用
      refund: refundId
        ? {
            id: refundId,
            amount: refundAmount, // 日元单位
            currency: "JPY"
          }
        : null,
      cancellationDetails: {
        feePercentage: cancellationFeePercentage,
        totalAmount: originalAmount, // 原始金额（日元）
        refundAmount: refundAmount,  // 退款金额（日元）
        feeAmount: originalAmount - refundAmount, // 取消费金额（日元）
        isFreeCancel: cancellationFeePercentage === 0
      }
    };
    
    // 如果应该有退款但没有创建成功
    if (cancellationFeePercentage === 0 && originalAmount > 0 && !refundId) {
      console.warn("警告：应该创建退款但未成功", {
        reservationId,
        originalAmount,
        cancellationFeePercentage
      });
      
      // 添加退款处理状态信息
      responseData.refundProcessing = {
        status: "failed",
        originalAmount: originalAmount,
        message: "返金処理に問題が発生しました。サポートにお問い合わせください。"
      };
    }
    
    // 发送预约取消确认邮件
    try {
      // 获取用户信息
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const userFullName = userData?.fullName || userEmail || "お客様";
      
      if (!USE_TEST_MODE) {
        await sendCancellationConfirmationEmail(
          userEmail,
          userFullName,
          {
            userId: userId,
            displayDate: reservationData.displayDate,
            displayTimeRange: reservationData.displayTimeRange,
            roomType: reservationData.roomType,
            price: reservationData.price,
            slowRoomAsSetPlan: reservationData.slowRoomAsSetPlan,
            displaySlowRoomTimeRange: reservationData.displaySlowRoomTimeRange
          },
          responseData.cancellationDetails
        );
        
        // 更新预约记录，标记取消邮件已发送
        await db
          .collection("reservations")
          .doc(reservationId)
          .update({
            cancellationEmailSent: true,
            cancellationEmailSentAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
          });
          
        console.log(`预约取消确认邮件已发送至 ${userEmail}`);
      } else {
        // 测试模式 - 只记录邮件内容但不实际发送
        console.log("测试模式 - 不发送实际邮件");
        console.log("预约取消确认邮件内容:", {
          to: userEmail,
          userName: userFullName,
          reservation: {
            id: reservationId,
            displayDate: reservationData.displayDate,
            displayTimeRange: reservationData.displayTimeRange,
            roomType: reservationData.roomType,
            price: reservationData.price
          },
          cancellationDetails: responseData.cancellationDetails
        });
      }
    } catch (emailError) {
      console.error("发送预约取消确认邮件时出错:", emailError);
      // 发送邮件失败不影响取消预约流程，仍然返回成功
    }
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    return NextResponse.json(
      { error: "予約のキャンセル中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";