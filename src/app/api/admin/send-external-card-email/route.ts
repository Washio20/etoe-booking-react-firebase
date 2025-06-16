import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { google } from "googleapis";
import crypto from "crypto";

// 获取Firebase Timestamp
const getFirebaseTimestamp = (date: Date) => {
  return Timestamp.fromDate(date);
};

// 生成安全的访问令牌
const generateSecureToken = (reservationId: string, secretKey = process.env.TOKEN_SECRET || "etoe_hotel_token_secret"): string => {
  // 使用HMAC-SHA256生成令牌，这样令牌与预约ID和密钥相关联
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(reservationId);
  // 返回前16个字符作为令牌，足够安全又不会太长
  return hmac.digest('hex').substring(0, 16);
};

// 确保Firebase Admin已初始化
initAdmin();

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

// 设置刷新令牌
oAuth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

// 使用Gmail API发送邮件 - 保持日文标题优先，使用纯文本格式并提供网站链接
async function sendEmailWithGmailApi(
  to: string,
  subject: string,
  htmlContent: string,
  reservationId: string,
  userName: string
): Promise<any> {
  try {
    // 获取授权客户端
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // 手动使用RFC2047标准编码邮件标题
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString(
      "base64"
    )}?=`;

    // 网站基础URL - 使用环境变量或固定值
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    // 为URL生成安全令牌 - 使用更安全的方法
    const mainCardToken = generateSecureToken(reservationId);

    // 创建查看条形码的链接（带安全令牌）
    const cardViewUrl = `${baseUrl}/external-card-view?reservationId=${reservationId}&token=${mainCardToken}`;
    const faqUrl = `${baseUrl}/faq`;

    // 创建纯文本邮件内容，包含访问网站的链接
    const textContent = `
${userName} 様

etoe｜お部屋カード情報のご案内

このたびは、etoe sauna & stayをご予約いただき、誠にありがとうございます。
ご滞在予定のお部屋にご入室いただくためのカード情報をお届けいたします。

入室カードのご確認はこちら
・ご予約のお部屋用バーコード
${cardViewUrl}

※ バーコードはご予約時間内のみ有効です。5分前よりご入室可能です。
※ 本リンクはお客様専用です。他の方と共有されませんようお願いいたします。

最新のキャンペーン情報を公式Instagramにてお届けしています。
https://www.instagram.com/etoe_tokyo/

etoeでのひとときが、
こころほどける、やさしい時間となりますように。

etoe
※本メールは送信専用です。ご返信には対応いたしかねますのでご了承ください。
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

    console.log("邮件发送成功:", res.data);
    return res.data;
  } catch (error) {
    console.error("使用Gmail API发送邮件失败:", error);
    throw error;
  }
}

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

    // 检查管理员权限
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    // 解析请求体
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return NextResponse.json(
        { error: "リクエストボディの解析に失敗しました" },
        { status: 400 }
      );
    }

    const {
      reservationId,
      userEmail,
      userName,
    } = requestBody;

    // 验证请求参数
    if (!reservationId || !userEmail || !userName) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    // 获取数据库实例
    const db = getFirestore();

    // 从外部预约表获取信息
    const reservationDoc = await db.collection("externalReservations").doc(reservationId).get();

    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: "予約情報が見つかりません" },
        { status: 404 }
      );
    }

    const reservationData = reservationDoc.data();

    if (!reservationData) {
      return NextResponse.json(
        { error: "予約データが無効です" },
        { status: 400 }
      );
    }

    // 确保预约数据包含卡片信息
    if (!reservationData.cardNumber || !reservationData.barcode) {
      return NextResponse.json(
        { error: "カード情報が含まれていません" },
        { status: 400 }
      );
    }

    // 提取房间号显示格式
    const roomNumberDisplay = reservationData.physicalRoomId.replace("room_", "");

    // 邮件主题 - 使用原始日文标题
    const emailSubject = "etoe｜お部屋カード情報のご案内";

    console.log("准备发送邮件到:", userEmail);

    try {
      // 使用 Gmail API 发送邮件 - 传递需要的ID参数
      await sendEmailWithGmailApi(
        userEmail,
        emailSubject,
        "", // 不再需要HTML内容，使用空字符串
        reservationId,
        userName
      );
      console.log("邮件发送成功");

      // 更新数据库中的发送状态 - 外部预约记录
      await db
        .collection("externalReservations")
        .doc(reservationId)
        .update({
          cardEmailSent: true,
          cardEmailSentAt: getFirebaseTimestamp(new Date()),
          updatedAt: getFirebaseTimestamp(new Date()),
        });

      return NextResponse.json({
        success: true,
        message: "メールが正常に送信されました",
      });
    } catch (error) {
      console.error("Gmail API 邮件发送失败:", error);
      // 返回详细错误信息以便调试
      return NextResponse.json(
        {
          error: "メール送信中にエラーが発生しました",
          details: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          config: {
            clientId: process.env.GMAIL_CLIENT_ID ? "已设置" : "未设置",
            clientSecret: process.env.GMAIL_CLIENT_SECRET
              ? "已设置"
              : "未设置",
            redirectUri: process.env.GMAIL_REDIRECT_URI ? "已设置" : "未设置",
            refreshToken: process.env.GMAIL_REFRESH_TOKEN
              ? "已设置"
              : "未设置",
            emailFrom: EMAIL_FROM,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error sending card email:", error);
    return NextResponse.json(
      {
        error: "メール送信中にエラーが発生しました",
        details: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic"; 