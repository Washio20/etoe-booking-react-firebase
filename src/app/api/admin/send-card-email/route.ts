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
  reservationId: string,
  cardId: string,
  slowRoomCardId?: string,
  userName?: string
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
    const slowRoomLines =
      slowRoomCardId && slowRoomCardViewUrl
        ? [`スロールーム用バーコードを表示する　${slowRoomCardViewUrl}`]
        : [];

    const textLines = [
      `${userName ? `${userName} 様` : "お客様"}`,
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
      ...slowRoomLines,
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

    const textContent = textLines.join("\n");

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

    // 获取用户完整信息
    let userFullName = reservation?.userFullName || reservation?.userName || null;
    
    // 如果没有用户全名且有userId，尝试从users集合获取
    if (!userFullName && reservation?.userId) {
      try {
        const userDoc = await db.collection("users").doc(reservation.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userFullName = userData?.fullName || userData?.name || null;
        }
      } catch (error) {
        console.error("获取用户信息失败:", error);
      }
    }

    // 获取主房间卡片信息
    const cardDoc = await db.collection("roomCards").doc(cardId).get();

    if (!cardDoc.exists) {
      return NextResponse.json(
        { error: "カード情報が見つかりません" },
        { status: 404 }
      );
    }

    // 获取预约者邮箱（如果请求中提供则使用，否则从预约记录中获取）
    let userEmail = emailFromRequest;
    if (!userEmail && reservation.userEmail) {
      userEmail = reservation.userEmail;
    }

    // 检查并获取Slow Room卡片信息（如果有）
    let includeSlowRoomLink = false;
    if (slowRoomCardId) {
      const slowRoomCardDoc = await db
        .collection("roomCards")
        .doc(slowRoomCardId)
        .get();
      if (slowRoomCardDoc.exists) {
        includeSlowRoomLink = true;
      } else {
        console.warn(`找不到指定的Slow Room卡片 ID: ${slowRoomCardId}`);
      }
    }

    // 提取用户名 - 优先使用从users表获取的完整信息
    const userName = userFullName || "";

    // 邮件主题 - 恢复使用原始日文标题
    const emailSubject = "etoe｜入室手順とカギ情報のご案内";

    console.log("准备发送邮件到:", userEmail);

    // 如果不是测试模式，则发送实际邮件
    if (!USE_TEST_MODE) {
      try {
        // 使用 Gmail API 发送邮件 - 传递需要的ID参数
        await sendEmailWithGmailApi(
          userEmail,
          emailSubject,
          reservationId,
          cardId,
          includeSlowRoomLink ? slowRoomCardId : undefined,
          userName
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
        process.env.NEXT_PUBLIC_BASE_URL;

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
      if (slowRoomCardId && includeSlowRoomLink) {
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
