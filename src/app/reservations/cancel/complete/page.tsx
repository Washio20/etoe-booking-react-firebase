"use client";

import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";

export default function ReservationCancelCompletePage() {
  const router = useRouter();

  return (
    <Layout>
      <div className="w-full max-w-[920px] mx-auto px-4 md:px-0 py-6 md:py-12">
        <div className="space-y-8 md:space-y-12">
          <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
            <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic leading-[1.5em] md:leading-normal">
              予約キャンセル完了
            </h1>
          </div>

          <div className="bg-white rounded-lg p-6 md:p-8 space-y-6 md:space-y-8 border border-[#EEEEEE]">
            <p className="text-[14px] md:text-[16px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              予約のキャンセルが完了しました。
            </p>
            <p className="text-[14px] md:text-[16px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              ご利用料金からキャンセル料を差し引いた金額は、お支払い時に使用されたクレジットカードに返金されます。
              返金処理には、通常5〜10営業日ほどかかる場合がございます。
            </p>
            <p className="text-[14px] md:text-[16px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              予約キャンセルのポリシーはご予約の部屋タイプにより異なります。
              サウナスイートは予約開始時間の7日前までは無料、7日前〜2日前まではキャンセル料50%、48時間前以降は100%となります。
              それ以外のお部屋は予約開始時間の48時間前まで無料で、以降はキャンセル料100%がかかります。
            </p>
            <p className="text-[14px] md:text-[16px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              ご不明な点がございましたら、お気軽にお問い合わせください。
            </p>

            <div className="flex justify-center pt-4 mt-6 border-t border-[#EEEEEE]">
              <button
                onClick={() => router.push("/reservations")}
                className="px-8 py-2 bg-[#444444] text-white rounded-full text-[14px] md:text-[16px] tracking-[0.06em] font-zen-kaku-gothic"
              >
                予約一覧へ戻る
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
