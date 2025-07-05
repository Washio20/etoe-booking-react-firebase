import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";

// 确保Firebase Admin已初始化
initAdmin();

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "トークンが必要です" },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const auth = getAuth();

    // 验证令牌获取
    const verificationDoc = await db
      .collection("emailVerifications")
      .doc(token)
      .get();

    if (!verificationDoc.exists) {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 400 }
      );
    }

    const verificationData = verificationDoc.data()!;

    // 检查是否已使用
    if (verificationData.used) {
      return NextResponse.json(
        { error: "このリンクは既に使用されています" },
        { status: 400 }
      );
    }

    // 检查是否过期
    const expiresAt = verificationData.expiresAt.toDate();
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { error: "リンクの有効期限が切れています" },
        { status: 400 }
      );
    }

    // 更新用户的邮箱验证状态
    const userId = verificationData.userId;
    
    // 在Firebase Auth中设置邮箱已验证
    await auth.updateUser(userId, {
      emailVerified: true
    });

    // 更新Firestore中的用户文档
    await db.collection("users").doc(userId).update({
      emailVerified: true,
      emailVerifiedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // 标记令牌已使用
    await db.collection("emailVerifications").doc(token).update({
      used: true,
      usedAt: Timestamp.now()
    });

    console.log(`Email verified for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: "メールアドレスが確認されました"
    });

  } catch (error) {
    console.error("Error verifying email:", error);
    return NextResponse.json(
      { error: "確認中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";