'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { applyActionCode, getAuth } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';

// 定义页面可能的状态
type VerificationStatus = 'loading' | 'success' | 'error';

// 创建一个内部组件来使用 useSearchParams
function EmailVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 使用单一状态变量来跟踪页面状态
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  
  useEffect(() => {
    async function verifyEmail() {
      try {
        const oobCode = searchParams.get('oobCode');
        if (!oobCode) {
          setErrorMessage('認証コードが無効です。もう一度お試しいただくか、カスタマーサポートにお問い合わせください');
          setStatus('error');
          return;
        }
        
        const auth = getAuth();
        
        // 应用验证码
        await applyActionCode(auth, oobCode);
        
        // 更新当前用户的数据库记录
        if (auth.currentUser) {
          // 更新Firestore中的emailVerified字段
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          await updateDoc(userDocRef, {
            emailVerified: true
          });
        }
        
        setStatus('success');
        
        // 3秒后重定向到会员页面
        setTimeout(() => {
          router.push('/member');
        }, 3000);
      } catch (error) {
        console.error('メール認証に失敗しました:', error);
        setErrorMessage('メール認証に失敗しました。リンクの有効期限が切れているか無効である可能性があります');
        setStatus('error');
      }
    }
    
    verifyEmail();
  }, [searchParams, router]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">メールアドレス認証</h1>
        
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="mt-4 text-center">メールアドレスを認証中です。しばらくお待ちください...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="text-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-16 w-16 text-green-500 mx-auto mb-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
            <h2 className="text-xl font-semibold mb-2">メールアドレス認証が完了しました！</h2>
            <p className="mb-4">3秒後に会員ページに自動的に移動します。</p>
            <button 
              onClick={() => router.push('/member')}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded focus:outline-none"
            >
              今すぐ会員ページへ
            </button>
          </div>
        )}
        
        {status === 'error' && (
          <div className="text-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-16 w-16 text-red-500 mx-auto mb-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <h2 className="text-xl font-semibold mb-2">認証失敗</h2>
            <p className="mb-4">{errorMessage}</p>
            <button 
              onClick={() => router.push('/login')}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded focus:outline-none"
            >
              ログインに戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 为了解决构建错误，使用 Suspense 包裹使用 useSearchParams 的组件
export default function EmailVerification() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center mb-6">メールアドレス認証</h1>
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="mt-4 text-center">読み込み中...</p>
          </div>
        </div>
      </div>
    }>
      <EmailVerificationContent />
    </Suspense>
  );
} 