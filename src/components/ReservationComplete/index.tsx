"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReservationComplete() {
  const router = useRouter();

  // 确保用户不能直接访问预约完成页面
  useEffect(() => {
    // 检查是否是从预约确认页面跳转过来的
    // 这里可以添加更多的检查逻辑来确保用户完成了预约流程
    // 例如，可以设置一个特殊的标志在预约确认页面中

    // 清除可能的残留预约信息
    if (localStorage.getItem("reservationInfo")) {
      localStorage.removeItem("reservationInfo");
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
        <h1 className="text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
          予約完了
        </h1>
      </div>

      <div className="space-y-8">
        <p className="text-[15px] text-[#444444] tracking-[0.06em] leading-[1.65] font-zen-kaku-gothic">
          ご予約いただきありがとうございます。
          <br />
          当日のご来館を心よりお待ちしております。
          <br />
          お持ち物等〜〜〜は下記のQ&Aをご覧ください。
        </p>

        <div className="flex justify-center pt-4">
          <button
            onClick={() => router.push("/reservations")}
            className="px-12 py-3 text-sm font-medium text-white bg-gray-700 rounded-full hover:bg-gray-800"
          >
            予約一覧へ
          </button>
        </div>
      </div>
    </div>
  );
}
