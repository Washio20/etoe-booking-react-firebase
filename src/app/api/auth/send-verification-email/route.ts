import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { google } from "googleapis";
import crypto from "crypto";

// 确保Firebase Admin已初始化
initAdmin();

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

// 配置邮件发送
const EMAIL_FROM = process.env.EMAIL_FROM 
  ? (process.env.EMAIL_FROM.includes('<') ? process.env.EMAIL_FROM : `etoe hotel <${process.env.EMAIL_FROM}>`)
  : "etoe hotel <no-reply@etoehotel.com>";

// 生成验证令牌
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// 发送验证邮件
async function sendVerificationEmail(
  email: string,
  userName: string,
  verificationLink: string
): Promise<void> {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  // 使用UTF-8编码邮件标题
  const utf8Subject = `=?utf-8?B?${Buffer.from("etoe｜メールアドレスの確認").toString("base64")}?=`;

  // 纯文本邮件内容
  const textContent = `${userName} 様

etoe sauna & stayへのご登録ありがとうございます。

以下のリンクをクリックして、メールアドレスの確認を完了してください：

${verificationLink}

※ このリンクは24時間有効です。
※ 本リンクはお客様専用です。他の方と共有されませんようお願いいたします。

もしこのメールに心当たりがない場合は、このメールを無視してください。

etoeでのひとときが、
こころほどける、やさしい時間となりますように。

etoe
※本メールは送信専用です。ご返信には対応いたしかねますのでご了承ください。`;

  const message = [
    `From: ${EMAIL_FROM}`,
    `To: ${email}`,
    `Subject: ${utf8Subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    textContent,
  ].join("\r\n");

  const encodedEmail = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedEmail,
    },
  });
}

export async function POST(req: Request) {
  try {
    const { userId, email, userName, reservationId } = await req.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    const db = getFirestore();
    
    // 生成验证令牌
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24小时有效期

    // 保存验证令牌到数据库
    await db.collection("emailVerifications").doc(verificationToken).set({
      userId,
      email,
      reservationId: reservationId || null,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false
    });

    // 生成验证链接
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    let verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;
    
    // 如果有预约ID，添加到URL参数中
    if (reservationId) {
      verificationLink += `&reservationId=${encodeURIComponent(reservationId)}`;
    }

    // 发送邮件
    await sendVerificationEmail(email, userName || "お客", verificationLink);

    console.log(`Verification email sent to ${email} with token ${verificationToken}`);

    return NextResponse.json({ 
      success: true,
      message: "確認メールを送信しました" 
    });

  } catch (error) {
    console.error("Error sending verification email:", error);
    return NextResponse.json(
      { error: "メール送信中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";