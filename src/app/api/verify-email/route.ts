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
    
    // Cloud Run 环境中适配正确的主机名
    // 使用 X-Forwarded-Host 头（由 Cloud Run 设置）或原始主机名
    let host = request.headers.get('x-forwarded-host') || 
               request.headers.get('host') || 
               'book.etoehotel.com';
               
    // 使用 X-Forwarded-Proto 头（由 Cloud Run 设置）或默认为 https
    let protocol = request.headers.get('x-forwarded-proto') || 'https';
    
    // 如果有明确的环境变量，优先使用
    if (process.env.NEXT_PUBLIC_BASE_URL) {
      const url = new URL(process.env.NEXT_PUBLIC_BASE_URL);
      host = url.host;
      protocol = url.protocol.replace(':', '');
    }
    
    // 构建完整的 URL
    const baseUrl = `${protocol}://${host}`;
    console.log(`[Email Verification] Redirecting to: ${baseUrl}${redirectUrl}`);
    
    // フロントエンド検証ページにリダイレクト
    return NextResponse.redirect(`${baseUrl}${redirectUrl}`);
  }
  
  // メール認証リクエストでない場合、ホームページにリダイレクト
  let host = request.headers.get('x-forwarded-host') || 
             request.headers.get('host') || 
             'book.etoehotel.com';
  let protocol = request.headers.get('x-forwarded-proto') || 'https';
  
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    const url = new URL(process.env.NEXT_PUBLIC_BASE_URL);
    host = url.host;
    protocol = url.protocol.replace(':', '');
  }
  
  const baseUrl = `${protocol}://${host}`;
  return NextResponse.redirect(`${baseUrl}/`);
} 