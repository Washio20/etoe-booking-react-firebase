"use client";

import { useRouter } from "next/navigation";

export default function ContactComplete() {
  const router = useRouter();

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 px-4 md:px-0">
      <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
        <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
          お問い合わせ完了
        </h1>
      </div>

      <div className="space-y-6">
        <p className="text-[12px] md:text-[15px] text-[#444444] tracking-[0.06em] leading-[1.65] font-zen-kaku-gothic whitespace-pre-line">
          {`お問い合わせいただきありがとうございました。
順次内容を確認し、担当者よりお返事いたしますので
今しばらくお待ちください。
なお、内容によってはお返事差し上げられない場合がございますので
あらかじめご了承ください。`}
        </p>

        <div className="flex justify-center gap-4 mt-8 md:mt-12">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-8 py-2 md:px-12 md:py-3 bg-[#444444] text-white rounded-full text-[13px] md:text-[16px] tracking-[0.06em] font-zen-kaku-gothic font-bold"
          >
            トップページへ
          </button>
          <button
            type="button"
            onClick={() => router.push("/reservations")}
            className="px-8 py-2 md:px-12 md:py-3 bg-[#444444] text-white rounded-full text-[13px] md:text-[16px] tracking-[0.06em] font-zen-kaku-gothic font-bold"
          >
            予約一覧へ
          </button>
        </div>
      </div>
    </div>
  );
}
