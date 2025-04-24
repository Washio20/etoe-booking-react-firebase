import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { google } from "googleapis";

// 获取Firebase Timestamp
const getFirebaseTimestamp = (date: Date) => {
  return Timestamp.fromDate(date);
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

// 使用测试模式（不发送实际邮件）
const USE_TEST_MODE = false;

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
  cardId: string,
  slowRoomCardId?: string
): Promise<any> {
  try {
    // 获取授权客户端
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // 手动使用RFC2047标准编码邮件标题
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString(
      "base64"
    )}?=`;

    // 网站基础URL - 使用环境变量或固定值
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://etoehotel.com";

    // 为URL生成安全令牌 - 使用预约ID和卡ID的组合
    const mainCardToken = `${reservationId.slice(0, 8)}${cardId.slice(0, 8)}`;
    let slowRoomCardToken = "";
    if (slowRoomCardId) {
      slowRoomCardToken = `${reservationId.slice(0, 8)}${slowRoomCardId.slice(
        0,
        8
      )}`;
    }

    // 创建查看条形码的链接（带安全令牌）
    const cardViewUrl = `${baseUrl}/card-view?reservationId=${reservationId}&cardId=${cardId}&token=${mainCardToken}`;
    let slowRoomCardViewUrl = "";
    if (slowRoomCardId) {
      slowRoomCardViewUrl = `${baseUrl}/card-view?reservationId=${reservationId}&cardId=${slowRoomCardId}&token=${slowRoomCardToken}`;
    }
    const fqaUrl = `${baseUrl}/faq`;

    // 创建纯文本邮件内容，包含访问网站的链接
    let textContent = `
${subject}

etoe sauna & stay｜お部屋カード情報のご案内
このたびは、etoeをご予約いただき、誠にありがとうございます。
ご滞在予定のお部屋にご入室いただくためのカード情報をお届けいたします。
詳細なご予約内容は、会員ページよりご確認いただけます。

入室カードのご確認はこちら
・ご予約のお部屋用バーコード
${cardViewUrl}

`;

    // 如果有慢房间卡，也添加链接
    if (slowRoomCardId && slowRoomCardViewUrl) {
      textContent += `
・スロールーム用バーコード
${slowRoomCardViewUrl}

`;
    }

    textContent += `
※ バーコードはご予約時間内のみ有効です。
※ 本リンクはお客様専用です。他の方と共有されませんようお願いいたします。

よくあるご質問
${fqaUrl}

最新のキャンペーン情報を公式Instagramにてお届けしています。
https://www.instagram.com/etoe_tokyo/

etoeでのひとときが、
こころほどける、やさしい時間となりますように。

etoe hotel
Email: info@etoehotel.com
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
      cardId,
      userEmail: emailFromRequest,
      slowRoomCardId,
    } = requestBody;

    // 验证请求参数
    if (!reservationId || !cardId || !emailFromRequest) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    // 获取数据库实例
    const db = getFirestore();

    // 获取预约信息
    const reservationDoc = await db
      .collection("reservations")
      .doc(reservationId)
      .get();

    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: "予約が見つかりません" },
        { status: 404 }
      );
    }

    const reservation = reservationDoc.data();

    if (!reservation) {
      return NextResponse.json(
        { error: "カードデータが無効です" },
        { status: 400 }
      );
    }

    // 获取主房间卡片信息
    const cardDoc = await db.collection("roomCards").doc(cardId).get();

    if (!cardDoc.exists) {
      return NextResponse.json(
        { error: "カード情報が見つかりません" },
        { status: 404 }
      );
    }

    const card = cardDoc.data();

    if (!card) {
      return NextResponse.json(
        { error: "カードデータが無効です" },
        { status: 400 }
      );
    }

    // 获取预约者邮箱（如果请求中提供则使用，否则从预约记录中获取）
    let userEmail = emailFromRequest;
    if (!userEmail && reservation.userEmail) {
      userEmail = reservation.userEmail;
    }

    // 检查并获取Slow Room卡片信息（如果有）
    let slowRoomCard = null;
    if (slowRoomCardId) {
      const slowRoomCardDoc = await db
        .collection("roomCards")
        .doc(slowRoomCardId)
        .get();
      if (slowRoomCardDoc.exists) {
        slowRoomCard = slowRoomCardDoc.data();
      } else {
        console.warn(`找不到指定的Slow Room卡片 ID: ${slowRoomCardId}`);
      }
    }

    // 提取卡片数据显示用的格式
    const roomNumberDisplay = card.physicalRoomId.replace("room_", "");
    let slowRoomNumberDisplay = null;
    if (slowRoomCard) {
      slowRoomNumberDisplay = slowRoomCard.physicalRoomId.replace("room_", "");
    }

    // 格式化日期为显示用的格式
    const formatDate = (timestamp: any): string => {
      try {
        // 处理Firestore Timestamp
        if (timestamp && typeof timestamp === "object" && timestamp.seconds) {
          const date = new Date(timestamp.seconds * 1000);
          return date.toLocaleString("ja-JP");
        }

        // 处理Date对象或ISO字符串
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString("ja-JP");
        }

        return "日付不明";
      } catch (error) {
        console.error("日期格式化错误:", error);
        return "無効な日付";
      }
    };

    // 提取用户名 - 支持新字段结构
    const userName =
      reservation.userFullName || reservation.userName || "お客様";

    // 提取开始和结束时间
    const startDate = card.startAt;
    const endDate = card.endAt;

    let slowRoomStartDate = null;
    let slowRoomEndDate = null;
    if (slowRoomCard) {
      slowRoomStartDate = slowRoomCard.startAt;
      slowRoomEndDate = slowRoomCard.endAt;
    }

    // 构建邮件HTML内容
    const emailHtml = `
    <div style="font-family: 'メイリオ', 'Meiryo', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #F0EAE4; padding: 20px; text-align: center;">
        <h1 style="color: #444444; margin: 0;">etoe hotel</h1>
      </div>
      
      <div style="padding: 20px; border: 1px solid #ddd; background-color: #fff;">
        <p>${userName} 様</p>
        
        <p>この度はetoe hotelをご予約いただき、誠にありがとうございます。</p>
        <p>ご予約のお部屋の入室カード情報をお送りいたします。</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #444444;">
          <h2 style="margin-top: 0; color: #444444; font-size: 18px;">入室カード情報</h2>
          <p><strong>部屋番号:</strong> ${roomNumberDisplay}</p>
          <p><strong>有効期間:</strong> ${formatDate(startDate)} ~ ${formatDate(
      endDate
    )}</p>
          <p>※ 予約時間内のみ有効です。</p>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <p style="margin-bottom: 15px; font-weight: bold;">入室用バーコード</p>
          <div>
            <img src="${
              card.barcode
            }" alt="入室バーコード" style="max-width: 100%; height: auto;">
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 10px;">
            上記バーコードを部屋前のスキャナーにかざして入室してください。
          </p>
        </div>
        
        ${
          slowRoomCard
            ? `
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #7B9178;">
          <h2 style="margin-top: 0; color: #444444; font-size: 18px;">スロールームカード情報</h2>
          <p><strong>部屋番号:</strong> ${slowRoomNumberDisplay}</p>
          <p><strong>有効期間:</strong> ${formatDate(
            slowRoomStartDate
          )} ~ ${formatDate(slowRoomEndDate)}</p>
          <p>※ 予約時間内のみ有効です。</p>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <p style="margin-bottom: 15px; font-weight: bold;">スロールーム入室用バーコード</p>
          <div>
            <img src="${
              slowRoomCard.barcode
            }" alt="スロールーム入室バーコード" style="max-width: 100%; height: auto;">
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 10px;">
            上記バーコードをスロールーム前のスキャナーにかざして入室してください。
          </p>
        </div>
        `
            : ""
        }
        
        <p>その他ご不明な点がございましたら、お気軽にお問い合わせください。</p>
        <p>お客様のご来館を心よりお待ちしております。</p>
        
        <div style="margin-top: 30px;">
          <p style="margin-bottom: 5px;">etoe hotel</p>
          <p style="margin-bottom: 5px;">TEL: 000-0000-0000</p>
          <p style="margin-bottom: 5px;">Email: info@etoehotel.com</p>
        </div>
      </div>
      
      <div style="background-color: #444444; color: white; padding: 15px; text-align: center; font-size: 12px;">
        &copy; 2023 etoe hotel All Rights Reserved.
      </div>
    </div>
    `;

    // 邮件主题 - 恢复使用原始日文标题
    const emailSubject = "【etoe hotel】ご予約のお部屋カード情報";

    console.log("准备发送邮件到:", userEmail);

    // 如果不是测试模式，则发送实际邮件
    if (!USE_TEST_MODE) {
      try {
        // 使用 Gmail API 发送邮件 - 传递需要的ID参数
        await sendEmailWithGmailApi(
          userEmail,
          emailSubject,
          emailHtml,
          reservationId,
          cardId,
          slowRoomCardId
        );
        console.log("邮件发送成功");

        // 更新数据库中的发送状态
        await db
          .collection("reservations")
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
    } else {
      // 测试模式 - 只记录邮件内容但不实际发送
      console.log("测试模式 - 不发送实际邮件");

      // 网站基础URL - 使用环境变量或固定值
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "https://etoehotel.com";

      // 为URL生成安全令牌
      const mainCardToken = `${reservationId.slice(0, 8)}${cardId.slice(0, 8)}`;
      let slowRoomCardToken = "";
      if (slowRoomCardId) {
        slowRoomCardToken = `${reservationId.slice(0, 8)}${slowRoomCardId.slice(
          0,
          8
        )}`;
      }

      // 创建查看条形码的链接（带安全令牌）
      const cardViewUrl = `${baseUrl}/card-view?reservationId=${reservationId}&cardId=${cardId}&token=${mainCardToken}`;
      let slowRoomCardViewUrl = "";
      if (slowRoomCardId) {
        slowRoomCardViewUrl = `${baseUrl}/card-view?reservationId=${reservationId}&cardId=${slowRoomCardId}&token=${slowRoomCardToken}`;
      }

      console.log("邮件内容:", {
        to: userEmail,
        subject: emailSubject,
        cardViewUrl: cardViewUrl,
        slowRoomCardViewUrl: slowRoomCardViewUrl,
      });

      // 更新数据库中的发送状态
      await db
        .collection("reservations")
        .doc(reservationId)
        .update({
          cardEmailSent: true,
          cardEmailSentAt: getFirebaseTimestamp(new Date()),
          updatedAt: getFirebaseTimestamp(new Date()),
        });

      return NextResponse.json({
        success: true,
        message: "テストモード: メール送信をシミュレートしました",
        emailContent: {
          to: userEmail,
          subject: emailSubject,
          cardViewUrl: cardViewUrl,
          slowRoomCardViewUrl: slowRoomCardViewUrl,
        },
      });
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
