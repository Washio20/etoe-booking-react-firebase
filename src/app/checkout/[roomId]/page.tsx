'use client';

import { useId, useState } from 'react';
import { useParams } from 'next/navigation';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import Layout from '@/components/Layout';

const DoubleThumbsIcon = ({ className }: { className?: string }) => {
  const maskId = useId();
  const frontTransform = 'translate(0 3) scale(0.85)';
  const backTransform = 'translate(9 -1) scale(0.85)';
  const maskTransform = 'translate(0 4) scale(0.78)';
  const thumbPaths = (
    <>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </>
  );

  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <mask id={maskId}>
        <rect width="32" height="32" fill="white" />
        <g
          transform={maskTransform}
          fill="black"
          stroke="black"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {thumbPaths}
        </g>
      </mask>
      <g mask={`url(#${maskId})`} transform={backTransform}>
        {thumbPaths}
      </g>
      <g transform={frontTransform}>
        {thumbPaths}
      </g>
    </svg>
  );
};

export default function CheckoutPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'checkout' | 'feedback' | null>(null);
  const [message, setMessage] = useState('');
  const [guestNote, setGuestNote] = useState('');
  const [flowStep, setFlowStep] = useState<'rate' | 'done' | 'thanks'>('rate');
  const [stayRating, setStayRating] = useState<'not_great' | 'good' | 'excellent' | ''>('');
  const [checkoutId, setCheckoutId] = useState('');

  // 验证房间号格式
  const isValidRoomId = (id: string): boolean => {
    return /^\d{3}$/.test(id);
  };

  const handleCheckout = async () => {
    if (!isValidRoomId(roomId)) {
      setMessage('無効な部屋番号です');
      return;
    }

    if (!stayRating) {
      setMessage('評価を選択してください');
      return;
    }

    setIsLoading(true);
    setLoadingAction('checkout');
    setMessage('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          stayRating,
          mode: 'checkout'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCheckoutId(data.checkoutId || '');
        setFlowStep('done');
      } else {
        setMessage(data.message || data.error || '退房手続きでエラーが発生しました');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setMessage('ネットワークエラーが発生しました');
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!checkoutId) {
      setMessage('チェックアウト情報が見つかりません');
      return;
    }

    if (!guestNote.trim()) {
      setMessage('ご感想・ご要望をご入力ください');
      return;
    }

    setIsLoading(true);
    setLoadingAction('feedback');
    setMessage('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkoutId,
          guestNote: guestNote.trim(),
          mode: 'feedback'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setFlowStep('thanks');
      } else {
        setMessage(data.message || data.error || 'フィードバック送信でエラーが発生しました');
      }
    } catch (error) {
      console.error('Feedback error:', error);
      setMessage('ネットワークエラーが発生しました');
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  if (!isValidRoomId(roomId)) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h1 className="text-xl font-bold text-gray-800 mb-4">
                <span className="block text-lg mb-1">Invalid Room Number</span>
                <span className="font-zen-kaku-gothic">無効な部屋番号</span>
              </h1>
              <p className="text-gray-600">
                <span className="block text-sm mb-1">The room number is incorrect.</span>
                <span className="block text-sm mb-2">Please scan the QR code again.</span>
                <span className="font-zen-kaku-gothic">部屋番号が正しくありません。<br />
                QRコードを再度スキャンしてください。</span>
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
          {flowStep === 'rate' ? (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                  <span className="block text-xl mb-1">Check Out</span>
                  <span className="font-zen-kaku-gothic">チェックアウト</span>
                </h1>
                <p className="text-lg text-gray-700">
                  <span className="block text-base">Room {roomId}</span>
                  <span className="font-zen-kaku-gothic">{roomId}号室</span>
                </p>
              </div>

              <div className="mb-6">
                <div className="rounded-2xl bg-[#d7b19b] text-center py-4 px-4 mb-4">
                  <p className="text-base font-semibold text-gray-900">
                    <span className="block font-zen-kaku-gothic">ご滞在はいかがでしたか？</span>
                    <span className="block">How was your stay?</span>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      value: 'not_great',
                      labelJa: 'イマイチ',
                      labelEn: 'Not great',
                      Icon: ThumbsDown,
                      iconType: 'single'
                    },
                    {
                      value: 'good',
                      labelJa: 'イイネ',
                      labelEn: 'Good',
                      Icon: ThumbsUp,
                      iconType: 'single'
                    },
                    {
                      value: 'excellent',
                      labelJa: '最高!',
                      labelEn: 'Excellent',
                      Icon: ThumbsUp,
                      iconType: 'double'
                    }
                  ].map(({ value, labelJa, labelEn, Icon, iconType }) => {
                    const selected = stayRating === value;
                    const iconStroke = 'text-gray-800';
                    const iconFill = 'fill-transparent';
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setStayRating(value as typeof stayRating);
                          setMessage('');
                        }}
                        className={`flex flex-col items-center gap-2 rounded-xl px-3 py-3 text-xs transition-colors ${
                          selected
                            ? 'border border-[#726659] bg-[#F3EDE7] text-gray-800'
                            : 'border border-transparent bg-transparent text-gray-800'
                        }`}
                        aria-pressed={selected}
                      >
                        <span className="font-zen-kaku-gothic text-sm font-semibold">{labelJa}</span>
                        <span className="text-[11px] font-semibold">{labelEn}</span>
                        {iconType === 'double' ? (
                          <DoubleThumbsIcon className={`mt-2 h-12 w-12 ${iconStroke}`} />
                        ) : (
                          <Icon className={`mt-2 h-8 w-8 ${iconStroke} ${iconFill}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isLoading || !stayRating}
                className={`w-full py-3 px-4 rounded-full text-white font-zen-kaku-gothic font-medium transition-colors ${
                  isLoading || !stayRating
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-[#444444] hover:bg-[#333333]'
                }`}
              >
                {isLoading && loadingAction === 'checkout' ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                      <span className="text-sm">Processing...</span>
                    </div>
                    <span className="text-sm">処理中...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="text-sm">Check Out</span>
                    <span className="text-sm">チェックアウトする</span>
                  </div>
                )}
              </button>

              {message && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-800">
                  <p className="text-sm font-zen-kaku-gothic">{message}</p>
                </div>
              )}
            </>
          ) : flowStep === 'done' ? (
            <div className="text-center">
              <div className="text-green-500 text-4xl mb-4">✅</div>
              <h1 className="text-xl font-bold text-gray-800 mb-2">
                <span className="block text-lg mb-1">Check Out Complete</span>
                <span className="font-zen-kaku-gothic">チェックアウト完了</span>
              </h1>
              <p className="text-sm text-gray-700 mb-4">
                <span className="block">If you have any feedback, we would love to hear it.</span>
                <span className="font-zen-kaku-gothic">もし何かお気づきの点がございましたら<br />ぜひお聞かせください。</span>
              </p>

              <div className="text-left">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="block text-sm mb-1">Feedback / Requests (Optional)</span>
                  <span className="font-zen-kaku-gothic">ご感想・ご要望（任意）</span>
                </label>
                <textarea
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-zen-kaku-gothic"
                  rows={4}
                  placeholder="Please share your feedback or requests / ご滞在のご感想やご要望がございましたらお聞かせください"
                  maxLength={500}
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-1 font-zen-kaku-gothic">
                  {guestNote.length}/500文字
                </p>

                <button
                  onClick={handleSubmitFeedback}
                  disabled={isLoading || !guestNote.trim()}
                  className={`mt-4 w-full rounded-md border px-4 py-2 text-sm font-zen-kaku-gothic transition-colors ${
                    isLoading || !guestNote.trim()
                      ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                      : 'border-gray-500 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isLoading && loadingAction === 'feedback' ? '送信中...' : '送信する'}
                </button>
              </div>

              {message && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-800">
                  <p className="text-sm font-zen-kaku-gothic">{message}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-gray-800 text-5xl mb-4">✅</div>
              <h1 className="text-xl font-bold text-gray-800 mb-3">
                <span className="block text-lg mb-1">Feedback</span>
                <span className="font-zen-kaku-gothic">フィードバック</span>
              </h1>
              <p className="text-lg font-bold text-gray-800 mb-2 font-zen-kaku-gothic">
                ありがとうございます
              </p>
              <p className="text-sm text-gray-600 font-zen-kaku-gothic">
                お送りいただいたフィードバックは<br />
                サービス向上に活用いたします。
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            <span className="block mb-1">If you encounter any issues, please contact the front desk.</span>
            <span className="font-zen-kaku-gothic">問題が発生した場合は、フロントまでお声かけください</span>
          </p>
        </div>
      </div>
    </Layout>
  );
}
