import React from 'react';

interface FacilityGuideDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FacilityGuideDialog({ isOpen, onClose }: FacilityGuideDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="bg-[#8A7A6A] text-white px-6 py-4 sticky top-0">
          <h2 className="text-xl font-bold font-zen-kaku-gothic">CHECK-IN INFO｜ご利用案内</h2>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-6">
          {/* 無人チェックイン＆チェックアウト */}
          <section>
            <h3 className="text-lg font-bold text-[#8A7A6A] mb-3 font-zen-kaku-gothic">
              ■ 無人チェックイン＆チェックアウト
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                • ご予約時間の5分前から入室可能です
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                • 全館禁煙（電子タバコ含む）
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                • Wi-Fi等の館内サービスはお部屋のQRからご確認ください。
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                • 退室の際は、客室扉のQRをスキャンして「チェックアウト」を押してください。
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                • 操作がない場合、延長料金が発生することがあります。
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                • ご宿泊の方で、荷物預かりやサウナ予約をご希望の方は、ベルボタンでスタッフをお呼びください
              </p>
            </div>
          </section>

          {/* ドリンク・レンタル水着の購入方法 */}
          <section>
            <h3 className="text-lg font-bold text-[#8A7A6A] mb-3 font-zen-kaku-gothic">
              ■ ドリンク・レンタル水着の購入方法（有料）
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                • 1Fラウンジにてご提供してます。QRコードを読み取り、購入してください。
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                • レンタル水着は使用後、サウナ室のソファへ置いてください。
              </p>
            </div>
          </section>

          {/* サウナ・日帰り客室ご利用の方 */}
          <section>
            <h3 className="text-lg font-bold text-[#8A7A6A] mb-3 font-zen-kaku-gothic">
              ■ サウナ・日帰り客室ご利用の方
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                • サウナをご利用の方は、入口で靴を脱ぎ予約した部屋の靴箱をご利用ください。
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                • サウナと客室の日帰りセットプランの方は、サウナ後バスローブで客室へご移動いただけます。使い捨てスリッパが必要な方は、スタッフへお気軽にお声がけください。ご自身の靴はお忘れずに客室へご持参ください。
              </p>
            </div>
          </section>

          {/* 英語案内 */}
          <section className="border-t pt-6">
            <h3 className="text-lg font-bold text-[#8A7A6A] mb-3">
              ■ Check-in & Check-out
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-700">
                • For check-in, please press the bell button. You may enter your room from 5 minutes before your reservation time
              </p>
              <p className="text-sm text-gray-700">
                • Smoking is prohibited, including e-cigarettes
              </p>
              <p className="text-sm text-gray-700">
                • For Wi-Fi and in-room info, scan the QR code in your room
              </p>
              <p className="text-sm text-gray-700">
                • Scan the QR code on the door and tap &quot;Check-out&quot;. If not completed, overtime charges may apply
              </p>
              <p className="text-sm text-gray-700">
                • For luggage storage or sauna booking, press the bell to call staff
              </p>
              <p className="text-sm text-gray-700">
                • Purchase drink etc via QR code in the 1F lounge (cashless)
              </p>
              <p className="text-sm text-gray-700">
                • Return rental swimwear to the sauna room sofa after use
              </p>
            </div>
          </section>

          {/* 閉じるボタン */}
          <div className="pt-4 flex justify-center">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-[#8A7A6A] text-white rounded-full hover:bg-[#7A6A5A] transition-colors font-medium font-zen-kaku-gothic"
            >
              確認しました
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}