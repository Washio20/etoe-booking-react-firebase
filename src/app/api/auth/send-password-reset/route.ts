import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { google } from "googleapis";
import crypto from "crypto";

// 確保Firebase Admin已初始化
initAdmin();

// OAuth2 客户端配置
const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// 設置刷新令牌
oAuth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

// 配置邮件发送
const EMAIL_FROM = process.env.EMAIL_FROM 
  ? (process.env.EMAIL_FROM.includes('<') ? process.env.EMAIL_FROM : `etoe hotel <${process.env.EMAIL_FROM}>`)
  : "etoe hotel <no-reply@etoehotel.com>";

// 生成重置令牌
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// 发送密码重置邮件
async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetLink: string
): Promise<void> {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  // 使用UTF-8编码邮件标题
  const utf8Subject = `=?utf-8?B?${Buffer.from("etoe｜パスワードのリセット").toString("base64")}?=`;

  // 纯文本邮件内容
  const textContent = `${userName} 様

etoe sauna & stayをご利用いただきありがとうございます。

パスワードリセットのリクエストを受け付けました。
以下のリンクをクリックして、新しいパスワードを設定してください：

${resetLink}

※ このリンクは1時間有効です。
※ 本リンクはお客様専用です。他の方と共有されませんようお願いいたします。

もしこのメールに心当たりがない場合は、このメールを無視してください。
パスワードは変更されません。

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
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスが必要です" },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const auth = getAuth();

    // ユーザーが存在するか確認
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (error) {
      // ユーザーが存在しない場合でも、セキュリティのため成功を返す
      console.log(`User not found for email: ${email}`);
      return NextResponse.json({ 
        success: true,
        message: "メールアドレスが登録されている場合、パスワードリセットメールを送信しました" 
      });
    }

    // ユーザー情報を取得
    const userDoc = await db.collection("users").doc(user.uid).get();
    const userData = userDoc.data();
    const userName = userData?.fullName || "お客";

    // 生成重置令牌
    const resetToken = generateResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1時間有効

    // 保存重置令牌到数据库
    await db.collection("passwordResets").doc(resetToken).set({
      userId: user.uid,
      email: email,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false
    });

    // 生成重置链接
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    // 发送邮件
    await sendPasswordResetEmail(email, userName, resetLink);

    console.log(`Password reset email sent to ${email} with token ${resetToken}`);

    return NextResponse.json({ 
      success: true,
      message: "パスワードリセットメールを送信しました" 
    });

  } catch (error) {
    console.error("Error sending password reset email:", error);
    return NextResponse.json(
      { error: "メール送信中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";