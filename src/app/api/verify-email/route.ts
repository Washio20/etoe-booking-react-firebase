import { NextRequest, NextResponse } from 'next/server';
import { applyActionCode } from 'firebase/auth';
import { initAdmin } from '@/utils/firebase-admin';
import admin from "firebase-admin";
import { auth as clientAuth } from '@/utils/firebase';

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";

// 确保Firebase Admin已初始化
initAdmin();

/**
 * メールアドレス認証を処理するAPI
 * クライアントサイドから直接Firebaseを呼び出すのではなく、このAPIを経由して認証を行う
 */
export async function POST(request: NextRequest) {
  try {
    // リクエストボディからactionCodeを取得
    const body = await request.json();
    const { oobCode } = body;
    
    if (!oobCode) {
      return NextResponse.json({ 
        success: false, 
        error: "認証コードが必要です" 
      }, { status: 400 });
    }
    
    console.log("[API] メール認証処理:", { oobCode: `${oobCode.substring(0, 10)}...` });
    
    // Firebase Clientを使用してメール認証を行う
    try {
      await applyActionCode(clientAuth, oobCode);
      
      console.log("[API] メール認証成功");
      
      return NextResponse.json({ 
        success: true,
        message: "メールアドレスの認証が完了しました"
      });
    } catch (error: any) {
      console.error("[API] メール認証処理に失敗:", error);
      
      // エラーコードに基づいてエラーメッセージを設定
      let errorMessage = "メール認証に失敗しました";
      let statusCode = 400;
      
      if (error.code === "auth/invalid-action-code") {
        errorMessage = "認証リンクが無効または期限切れです";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "ユーザーアカウントが無効になっています";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "ユーザーが存在しません";
      }
      
      return NextResponse.json({
        success: false,
        error: errorMessage,
        code: error.code
      }, { status: statusCode });
    }
  } catch (error) {
    console.error("[API] リクエスト処理エラー:", error);
    return NextResponse.json({ 
      success: false, 
      error: "サーバーエラーが発生しました" 
    }, { status: 500 });
  }
} 