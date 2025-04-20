import React from "react";
import Image from "next/image";
import Layout from "@/components/Layout";

export default function GuidePage() {
  // 步骤数据
  const steps = [
    {
      number: "1",
      title: "WEBよりご予約",
      description: `・WEB上の専用予約ページにて、空き状況をご確認の上、ご予約をお願いします。
・お支払いは、ご予約開始時刻の24時間前に実行されます。
それ以降ご予約の場合は、ご予約時即時決済となります。
・決済が失敗した場合、メールにてご連絡させていただきます。
※ご予約は完了しておりますので、予約開始前までにご対応をお願いいたします。
・電話でのご予約はご利用できません。`,
    },
    {
      number: "2",
      title: "ご来店・受付",
      description: `・ご予約時間の5分前を目安にご来店ください。
・受付にて予約内容の確認をいたします。
・アルコールチェックを実施いたします。アルコールを摂取しての利用は固くお断りいたします。
・貴重品はフロントでお預かりします。
・館内では備え付けの館内着・スリッパをご利用ください。`,
    },
    {
      number: "3",
      title: "ご利用",
      description: `・ロッカーに私物を保管し、館内着に着替えてください。
・貴重品は受付にお預けください。
・サウナ室内での水分補給はマイボトルをご利用ください。（ガラス製品不可）
・水風呂は体を洗ってからご利用ください。
・他のお客様のご迷惑となる行為はお控えください。`,
    },
    {
      number: "4",
      title: "チェックアウト",
      description: `・ご利用終了時間になりましたら、ロッカールームに戻り、着替えをお願いいたします。
・館内着・タオル等はすべて返却してください。
・お忘れ物のないようご確認ください。
・受付で貴重品をお受け取りください。
・追加料金が発生した場合は、精算をお願いいたします。`,
    },
    {
      number: "5",
      title: "アンケート回答（任意）",
      description: `・ご利用後、メールにてアンケートをお送りいたします。
・サービス向上のため、ぜひご回答いただければ幸いです。
・特に気になる点やご要望等ございましたら、ご記入ください。
・アンケートにご回答いただいた方には、次回ご利用時に使える特典をご用意しております。`,
    },
  ];

  return (
    <Layout>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-6 md:py-12">
        <div className="max-w-7xl mx-auto space-y-8 md:space-y-12">
          <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
            <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              利用ガイド
            </h1>
          </div>

          <div className="space-y-4 md:space-y-6">
            {steps.map((step, index) => (
              <div
                key={index}
                className="border border-[#BBBBBB] rounded-[4px] bg-white flex flex-col md:flex-row overflow-hidden"
              >
                {/* 图片区域 - 在手机端和PC端都显示，但位置不同 */}
                <div className="flex md:hidden w-full justify-center items-center p-3 bg-white">
                  <div className="relative w-full h-[100px]">
                    <Image
                      src="/images/room.png"
                      alt="サウナ室の写真"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
                <div className="hidden md:flex w-[220px] justify-center items-center p-4">
                  <div className="relative w-full h-[140px]">
                    <Image
                      src="/images/room.png"
                      alt="サウナ室の写真"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
                <div className="flex-grow py-3 md:py-4 px-3 md:px-8 space-y-1 md:space-y-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] md:text-[13px] text-[#C78C51] tracking-[0.06em] font-zen-kaku-gothic font-bold inline-block">
                      Step.{step.number}
                    </span>
                    <div className="h-[1px] bg-[#C78C51] w-[45px]" />
                  </div>
                  <h2 className="text-[14px] md:text-[16px] font-medium text-[#444444] tracking-[0.06em] font-zen-kaku-gothic mt-1 md:mt-2">
                    {step.title}
                  </h2>
                  <p className="text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] leading-[1.65] font-zen-kaku-gothic whitespace-pre-line">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
