"use client";

import React, { useState } from "react";
import Layout from "@/components/Layout";

interface FAQItem {
  id: number;
  question: string;
  answer: React.ReactNode;
}

export default function FAQPage() {
  const faqItems: FAQItem[] = [
    {
      id: 1,
      question: "事前の決済が失敗してしまった場合",
      answer: (
        <>
          ・WEB上の専用予約ページにて、空き状況をご確認の上、ご予約をお願いします。
          <br />
          ・お支払いは、ご予約開始時刻の24時間前に実行されます。
          <br />
          それ以降ご予約の場合は、ご予約時即時決済となります。
          <br />
          ・決済が失敗した場合、メールにてご連絡させていただきます。
          <br />
          ※ご予約は完了しておりますので、予約開始前までにご対応をお願いいたします。
          <br />
          ・電話でのご予約はご利用できません。
        </>
      ),
    },
    {
      id: 2,
      question: "事前の決済が失敗してしまった場合",
      answer: "回答内容がここに表示されます。",
    },
    {
      id: 3,
      question: "事前の決済が失敗してしまった場合",
      answer: "回答内容がここに表示されます。",
    },
    {
      id: 4,
      question: "事前の決済が失敗してしまった場合",
      answer: "回答内容がここに表示されます。",
    },
  ];

  const [expandedItems, setExpandedItems] = useState<number[]>([1]);

  const toggleItem = (id: number) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  return (
    <Layout>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-6 md:py-12">
        <div className="space-y-8 md:space-y-12">
          <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
            <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              よくある質問
            </h1>
          </div>

          <div className="space-y-3 md:space-y-4">
            {faqItems.map((item) => (
              <div key={item.id} className="space-y-2">
                <div
                  className="border border-[#BBBBBB] rounded-[4px] px-3 md:px-4 py-2 md:py-3 cursor-pointer"
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] md:text-[16px] font-medium text-[#C78C51] tracking-[0.06em] font-zen-kaku-gothic">
                        Q.
                      </span>
                      <span className="text-[12px] md:text-[16px] font-medium text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                        {item.question}
                      </span>
                    </div>
                    <span className="text-[16px] md:text-[20px] font-medium text-[#444444]">
                      {expandedItems.includes(item.id) ? "−" : "＋"}
                    </span>
                  </div>
                </div>

                {expandedItems.includes(item.id) && (
                  <div className="px-3 md:px-4 py-2 md:py-3">
                    <div className="flex items-start gap-1">
                      <span className="text-[13px] md:text-[16px] font-medium text-[#C78C51] tracking-[0.06em] font-zen-kaku-gothic">
                        A.
                      </span>
                      <p className="text-[12px] md:text-[15px] text-[#444444] tracking-[0.06em] leading-[1.65] font-zen-kaku-gothic">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
