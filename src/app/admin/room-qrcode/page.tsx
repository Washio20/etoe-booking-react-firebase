'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import Image from 'next/image';
import { auth } from '@/utils/firebase';
import Layout from '@/components/Layout';
import AdminLayout from '@/components/AdminLayout';
import QRCode from 'qrcode';

export default function RoomQrCodePage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });

  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});

  // 一般的なホテル房间号（1階: 101-110, 2階: 201-210, 3階: 301-310）
  const availableRooms = [
    ...Array.from({ length: 10 }, (_, i) => `10${i + 1}`), // 101-110
    ...Array.from({ length: 10 }, (_, i) => `20${i + 1}`), // 201-210
    ...Array.from({ length: 10 }, (_, i) => `30${i + 1}`), // 301-310
  ];

  // 检查管理员权限
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (loading) return;
      
      if (!user) {
        setAdminState({ isAdmin: false, checkComplete: true });
        return;
      }

      try {
        const idTokenResult = await user.getIdTokenResult();
        
        if (idTokenResult.claims.admin) {
          setAdminState({ isAdmin: true, checkComplete: true });
        } else {
          setAdminState({ isAdmin: false, checkComplete: true });
        }
      } catch (error) {
        console.error('管理员权限检查失败:', error);
        setAdminState({ isAdmin: false, checkComplete: true });
      }
    };

    checkAdminStatus();
  }, [user, loading]);

  const handleRoomSelection = (roomId: string) => {
    setSelectedRooms(prev => 
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const selectAllRooms = () => {
    setSelectedRooms(availableRooms);
  };

  const clearSelection = () => {
    setSelectedRooms([]);
    setQrCodes({});
  };

  const generateQrCodes = async () => {
    if (selectedRooms.length === 0) return;

    setIsGenerating(true);
    const newQrCodes: { [key: string]: string } = {};

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                     (typeof window !== 'undefined' ? window.location.origin : '');

      for (const roomId of selectedRooms) {
        const checkoutUrl = `${baseUrl}/checkout/${roomId}`;
        
        const qrDataUrl = await QRCode.toDataURL(checkoutUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        });

        newQrCodes[roomId] = qrDataUrl;
      }

      setQrCodes(newQrCodes);
    } catch (error) {
      console.error('QRコード生成エラー:', error);
      alert('QRコードの生成でエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQrCode = (roomId: string) => {
    const qrDataUrl = qrCodes[roomId];
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `room-${roomId}-checkout-qr.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const downloadAllQrCodes = async () => {
    for (const roomId of selectedRooms) {
      if (qrCodes[roomId]) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 短い遅延
        downloadQrCode(roomId);
      }
    }
  };

  // ローディング表示
  if (loading || !adminState.checkComplete) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </Layout>
    );
  }

  // 未ログイン時の表示
  if (!user) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic mb-4">
            管理者ページにアクセスするには、ログインしてください。
          </p>
          <button
            onClick={() => router.push("/login?returnTo=/admin/room-qrcode")}
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
          >
            ログイン
          </button>
        </div>
      </Layout>
    );
  }

  // 管理者権限がない場合の表示
  if (!adminState.isAdmin) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic">
            このページにアクセスする権限がありません。
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <AdminLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-300 pb-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wider font-zen-kaku-gothic">
              部屋QRコード生成
            </h1>
            <p className="text-sm text-gray-600 mt-2 font-zen-kaku-gothic">
              各部屋のドアに貼るチェックアウト用QRコードを生成します
            </p>
          </div>

          {/* 部屋選択 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900 font-zen-kaku-gothic">
                部屋選択
              </h2>
              <div className="space-x-2">
                <button
                  onClick={selectAllRooms}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 font-zen-kaku-gothic"
                >
                  全選択
                </button>
                <button
                  onClick={clearSelection}
                  className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 font-zen-kaku-gothic"
                >
                  クリア
                </button>
              </div>
            </div>

            <div className="grid grid-cols-5 md:grid-cols-10 gap-2 mb-4">
              {availableRooms.map(roomId => (
                <label
                  key={roomId}
                  className="flex items-center justify-center p-2 border rounded cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedRooms.includes(roomId)}
                    onChange={() => handleRoomSelection(roomId)}
                    className="sr-only"
                  />
                  <span className={`text-sm font-zen-kaku-gothic ${
                    selectedRooms.includes(roomId) 
                      ? 'text-blue-600 font-bold' 
                      : 'text-gray-700'
                  }`}>
                    {roomId}
                  </span>
                </label>
              ))}
            </div>

            <p className="text-sm text-gray-600 font-zen-kaku-gothic">
              選択済み: {selectedRooms.length}部屋
            </p>
          </div>

          {/* 生成ボタン */}
          <div className="flex justify-center">
            <button
              onClick={generateQrCodes}
              disabled={selectedRooms.length === 0 || isGenerating}
              className="px-6 py-3 bg-green-600 text-white font-zen-kaku-gothic rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  生成中...
                </>
              ) : (
                'QRコード生成'
              )}
            </button>
          </div>

          {/* QRコード表示 */}
          {Object.keys(qrCodes).length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900 font-zen-kaku-gothic">
                  生成されたQRコード
                </h2>
                <button
                  onClick={downloadAllQrCodes}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 font-zen-kaku-gothic"
                >
                  全てダウンロード
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {selectedRooms.map(roomId => {
                  const qrCode = qrCodes[roomId];
                  if (!qrCode) return null;

                  return (
                    <div key={roomId} className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                      <h3 className="text-center text-base font-bold text-gray-800 mb-2 font-zen-kaku-gothic">
                        {roomId}号室
                      </h3>
                      <div className="bg-white rounded p-2 mb-2">
                        <Image
                          src={qrCode}
                          alt={`Room ${roomId} QR Code`}
                          width={150}
                          height={150}
                          className="w-full h-auto mx-auto block"
                          style={{ maxWidth: '150px' }}
                          unoptimized={true}
                        />
                      </div>
                      <button
                        onClick={() => downloadQrCode(roomId)}
                        className="w-full px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 font-zen-kaku-gothic transition-colors"
                      >
                        ダウンロード
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <h3 className="text-sm font-medium text-yellow-800 mb-2 font-zen-kaku-gothic">
                  使用方法
                </h3>
                <ul className="text-sm text-yellow-700 font-zen-kaku-gothic space-y-1">
                  <li>• 各QRコードを印刷して、対応する部屋のドアに貼付してください</li>
                  <li>• お客様がQRコードをスキャンすると、チェックアウトページが開きます</li>
                  <li>• チェックアウト後の状況は「チェックアウト管理」ページで確認できます</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </Layout>
  );
}