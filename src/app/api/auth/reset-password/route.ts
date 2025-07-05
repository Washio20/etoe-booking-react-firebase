import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";

// 確保Firebase Admin已初始化
initAdmin();

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    // パスワードの検証
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "パスワードは6文字以上で入力してください" },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const auth = getAuth();

    // トークンを検証
    const resetDoc = await db
      .collection("passwordResets")
      .doc(token)
      .get();

    if (!resetDoc.exists) {
      return NextResponse.json(
        { error: "無効なリンクです" },
        { status: 400 }
      );
    }

    const resetData = resetDoc.data()!;

    // 既に使用されているか確認
    if (resetData.used) {
      return NextResponse.json(
        { error: "このリンクは既に使用されています" },
        { status: 400 }
      );
    }

    // 有効期限を確認
    const expiresAt = resetData.expiresAt.toDate();
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { error: "リンクの有効期限が切れています" },
        { status: 400 }
      );
    }

    // パスワードを更新
    const userId = resetData.userId;
    await auth.updateUser(userId, {
      password: newPassword
    });

    // トークンを使用済みにする
    await db.collection("passwordResets").doc(token).update({
      used: true,
      usedAt: Timestamp.now()
    });

    // ユーザー文書も更新（最終更新日時）
    await db.collection("users").doc(userId).update({
      updatedAt: Timestamp.now(),
      passwordChangedAt: Timestamp.now()
    });

    console.log(`Password reset successful for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: "パスワードが正常にリセットされました"
    });

  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "パスワードリセット中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// トークンの検証のみ（GETリクエスト）
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "トークンが必要です" },
        { status: 400 }
      );
    }

    const db = getFirestore();

    // トークンを検証
    const resetDoc = await db
      .collection("passwordResets")
      .doc(token)
      .get();

    if (!resetDoc.exists) {
      return NextResponse.json(
        { valid: false, error: "無効なリンクです" },
        { status: 200 }
      );
    }

    const resetData = resetDoc.data()!;

    // 既に使用されているか確認
    if (resetData.used) {
      return NextResponse.json(
        { valid: false, error: "このリンクは既に使用されています" },
        { status: 200 }
      );
    }

    // 有効期限を確認
    const expiresAt = resetData.expiresAt.toDate();
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { valid: false, error: "リンクの有効期限が切れています" },
        { status: 200 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: resetData.email
    });

  } catch (error) {
    console.error("Error validating token:", error);
    return NextResponse.json(
      { valid: false, error: "トークン検証中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";