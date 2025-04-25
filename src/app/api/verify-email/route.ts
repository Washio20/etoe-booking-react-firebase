import { NextRequest, NextResponse } from 'next/server';

/**
 * Firebase メール認証リンクを処理する
 * Firebaseの認証メールのリンクには、mode=verifyEmailパラメータとoobCodeパラメータが含まれています
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');
  const apiKey = searchParams.get('apiKey');
  
  // メール認証リクエストかどうかをチェック
  if (mode === 'verifyEmail' && oobCode) {
    // リダイレクトURLを構築し、すべてのパラメータをフロントエンド検証ページに渡す
    let redirectUrl = `/email-verification?mode=${mode}&oobCode=${oobCode}`;
    if (apiKey) {
      redirectUrl += `&apiKey=${apiKey}`;
    }
    
    // フロントエンド検証ページにリダイレクト
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }
  
  // メール認証リクエストでない場合、ホームページにリダイレクト
  return NextResponse.redirect(new URL('/', request.url));
} 