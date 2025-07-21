'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Layout from '@/components/Layout';

export default function CheckoutPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [guestNote, setGuestNote] = useState('');

  // 验证房间号格式
  const isValidRoomId = (id: string): boolean => {
    return /^\d{3}$/.test(id);
  };

  const handleCheckout = async () => {
    if (!isValidRoomId(roomId)) {
      setMessage('無効な部屋番号です');
      setIsSuccess(false);
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          guestNote: guestNote.trim() || undefined
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setMessage(data.message || '退房手続きが完了しました');
      } else {
        setIsSuccess(false);
        setMessage(data.message || data.error || '退房手続きでエラーが発生しました');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setIsSuccess(false);
      setMessage('ネットワークエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidRoomId(roomId)) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h1 className="text-xl font-bold text-gray-800 mb-4 font-zen-kaku-gothic">
                無効な部屋番号
              </h1>
              <p className="text-gray-600 font-zen-kaku-gothic">
                部屋番号が正しくありません。<br />
                QRコードを再度スキャンしてください。
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-md p-6">
          {!isSuccess ? (
            <>
              <div className="text-center mb-6">
                {/* <div className="flex justify-center mb-4">
                  <div className="w-24 mx-auto relative">
                    <Image
                      src="/images/logo.svg"
                      alt="etoe logo"
                      width={96}
                      height={53}
                      className="w-full h-auto"
                    />
                  </div>
                </div> */}
                <h1 className="text-2xl font-bold text-gray-800 mb-2 font-zen-kaku-gothic">
                  チェックアウト
                </h1>
                <p className="text-lg text-gray-700 font-zen-kaku-gothic">
                  {roomId}号室
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-zen-kaku-gothic">
                    ご感想・ご要望（任意）
                  </label>
                  <textarea
                    value={guestNote}
                    onChange={(e) => setGuestNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-zen-kaku-gothic"
                    rows={3}
                    placeholder="ご滞在のご感想やご要望がございましたらお聞かせください"
                    maxLength={500}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1 font-zen-kaku-gothic">
                    {guestNote.length}/500文字
                  </p>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-full text-white font-zen-kaku-gothic font-medium transition-colors ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-[#444444] hover:bg-[#333333]'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    処理中...
                  </div>
                ) : (
                  'チェックアウトする'
                )}
              </button>

              {message && (
                <div className={`mt-4 p-3 rounded-lg ${
                  isSuccess ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  <p className="text-sm font-zen-kaku-gothic">{message}</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="text-green-500 text-4xl mb-4">✅</div>
              <h1 className="text-xl font-bold text-gray-800 mb-4 font-zen-kaku-gothic">
                チェックアウト完了
              </h1>
              <p className="text-gray-700 font-zen-kaku-gothic mb-6">
                {message}
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800 font-zen-kaku-gothic leading-relaxed">
                  この度はご利用いただき、<br className="sm:hidden" />ありがとうございました。<br />
                  またのご利用を心よりお待ちしております。
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 font-zen-kaku-gothic">
            問題が発生した場合は、フロントまでお声かけください
          </p>
        </div>
      </div>
    </Layout>
  );
}