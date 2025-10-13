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

// 使用Gmail API发送邮件 - 支持日语和英语
async function sendEmailWithGmailApi(
  to: string,
  subject: string,
  reservationId: string,
  userName: string,
  language: 'ja' | 'en' = 'ja',
  variant: 'standard' | 'daytrip' = 'standard'
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

    // 根据语言选择邮件内容
    let textContent: string;

    if (variant === 'daytrip') {
      const lines = [
        `${userName} 様`,
        "",
        "このたびは etoe sauna & stay をご予約いただき、誠にありがとうございます。",
        "",
        "ご滞在予定のお部屋にご入室いただくための",
        "入室手順 と 入室カード情報 をお届けいたします。",
        "",
        "■お部屋への入り方",
        "当館は【 セルフチェックイン式 】となっています。",
        "",
        "入口がわかりづらくなっておりますので、入室までの手順をご確認ください。",
        "入室方法を見る　https://x.gd/mic4a",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "■入室用バーコード",
        "下記リンクより、お客様専用の 入室カード（バーコード） をご確認ください。",
        `入室カードを表示する　${cardViewUrl}`,
        "",
        "※バーコードは、ご予約時間から有効となります。",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "■チェックイン・ご利用について",
        "レンタル水着や延長方法など、よくあるご質問はこちらからご覧いただけます。",
        "よくあるご質問（FAQ）を見る　https://etoehotel.com/#faq",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "■etoe周辺のおすすめスポット",
        "ご滞在の前後に立ち寄れる、etoeスタッフお気に入りのカフェやレストランをご紹介しています。実際に訪れて「ここ、よかった…！」と感じた場所をマップにまとめました。",
        "おすすめマップを開く　https://maps.app.goo.gl/HVgzVEt4tVc2WyjC6",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "最新のキャンペーン情報やおすすめの過ごし方は、インスタグラム@etoe_tokyo にてご紹介しています。",
        "https://www.instagram.com/etoe_tokyo",
        "",
        "",
        "etoeでのひとときが、こころほどける、やさしい時間となりますように。",
        "お客様のご来館を心よりお待ちしております。",
        "",
        "",
        "etoe sauna & stay（エトエ）",
        "https://etoehotel.com/",
      ];
      textContent = lines.join("\n");
    } else if (language === 'en') {
      const lines = [
        `Dear ${userName},`,
        "",
        "Thank you very much for choosing etoe sauna & stay.",
        "We’re delighted to confirm your reservation and share the details for your upcoming stay.",
        "",
        "Below, you’ll find the check-in guide and your room access card information.",
        "",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "■ How to Enter Your Room",
        "",
        "Our facility operates with a 【 self check-in system 】",
        "",
        "As the entrance can be a little tricky to find, please make sure to review the step-by-step instructions before your arrival.",
        "",
        "Information on rental swimsuits, early check-in, and other FAQs is also available on the same page.",
        "",
        "",
        "◎View Check-in Guide & FAQ　https://x.gd/cmP4z",
        "",
        "",
        "If you need assistance from our front staff, please press the bell located in the 1st-floor lounge.",
        "",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "■ Room Access Card (Your Digital Key)",
        "",
        "Please use the link below to view your personal room access barcode.",
        "The barcode becomes valid at your reserved check-in time.",
        "",
        "",
        "◎View Access Card",
        `${cardViewUrl}`,
        "",
        "",
        "At night, the hotel entrance requires a barcode for entry. Please be sure to take your smartphone with you when you go out.",
        "",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "■ Recommended Spots Around etoe",
        "",
        "Discover our favorite cafes and restaurants around etoe — places we personally love and recommend for before or after your sauna session",
        "",
        "◎View Our Map　https://maps.app.goo.gl/HVgzVEt4tVc2WyjC6",
        "",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "Stay up to date with our latest campaigns and recommendations on Instagram @etoe_tokyo　https://www.instagram.com/etoe_tokyo",
        "",
        "May your time at etoe be a gentle moment where your heart and body unwind.",
        "We look forward to welcoming you soon.",
        "",
        "",
        "etoe sauna & stay (Etoe)",
        "https://etoehotel.com/",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "※ This is an automated message.",
        "Please note that replies to this email are not monitored.",
      ];
      textContent = lines.join("\n");
    } else {
      const lines = [
        `${userName} 様`,
        "",
        "このたびは etoe sauna & stay をご予約いただき、誠にありがとうございます。",
        "",
        "ご滞在予定のお部屋にご入室いただくための",
        "入室手順 と 入室カード情報 をお届けいたします。",
        "",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "■ お部屋への入り方",
        "当館は【 セルフチェックイン式 】となっています。",
        "",
        "入口がわかりづらくなっておりますので、入室までの手順を必ずご確認ください。レンタル水着やアーリーチェックインなど、よくあるご質問も、同ページ内でご案内しています。",
        "",
        "◎入室方法・FAQを見る　https://x.gd/cmP4z",
        "",
        "フロントスタッフに御用の方は、1Fのラウンジにあるベルにてお気軽にお呼びください。",
        "",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "■ 入室用バーコード",
        "下記リンクより、お客様専用の 入室カード（バーコード） をご確認ください。バーコードは、ご予約時間から有効となります。",
        "",
        `◎入室カードを表示する　${cardViewUrl}`,
        "",
        " 夜間は、入館にバーコードが必要です。お出かけの際は、必ずスマートフォンをお持ちください。",
        "",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "■ etoe周辺のおすすめスポット",
        "ご滞在の前後に立ち寄れる、etoeスタッフお気に入りのカフェやレストランをご紹介しています。実際に訪れて「ここ、よかった…！」と感じた場所をマップにまとめました。",
        "",
        "",
        "◎おすすめマップを開く　https://maps.app.goo.gl/HVgzVEt4tVc2WyjC6",
        "",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "最新のキャンペーン情報やおすすめの過ごし方は、インスタグラム @etoe_tokyo にてご紹介しています。",
        "https://www.instagram.com/etoe_tokyo",
        "",
        "",
        "etoeでのひとときが、こころほどける、やさしい時間となりますように。",
        "お客様のご来館を心よりお待ちしております。",
        "",
        "",
        "etoe sauna & stay（エトエ）",
        "https://etoehotel.com/",
        "",
        "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿",
        "",
        "※このメールは送信専用です。ご返信には対応いたしかねますのでご了承ください。",
      ];
      textContent = lines.join("\n");
    }

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
      language = 'ja', // デフォルトは日本語
      variant: variantRaw = 'standard',
    } = requestBody;

    const variant: 'standard' | 'daytrip' =
      variantRaw === 'daytrip' ? 'daytrip' : 'standard';

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

    // 邮件主题 - 根据语言或模板选择
    const emailSubject =
      variant === 'daytrip'
        ? "etoe｜入室手順とカギ情報のご案内"
        : language === 'en'
        ? "etoe｜Room Card Information"
        : "etoe｜入室手順とカギ情報のご案内";

    console.log("准备发送邮件到:", userEmail);

    try {
      // 使用 Gmail API 发送邮件 - 传递需要的ID参数和语言
      await sendEmailWithGmailApi(
        userEmail,
        emailSubject,
        reservationId,
        userName,
        language,
        variant
      );
      console.log("邮件发送成功");

      // 更新数据库中的发送状态 - 外部预约记录
      await db
        .collection("externalReservations")
        .doc(reservationId)
        .update({
          cardEmailSent: true,
          cardEmailSentAt: getFirebaseTimestamp(new Date()),
          cardEmailLanguage: language,
          cardEmailVariant: variant,
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
