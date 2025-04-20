"use client";

interface Purchase {
  id: string;
  date: string;
  time: string;
  orderNumber: string;
  items: {
    name: string;
    price: number;
  }[];
}

export default function AmenityPurchaseHistory() {
  // 模拟购买历史数据
  const purchases: Purchase[] = [
    {
      id: "1",
      date: "2025-1-3",
      time: "16:15:58 UTC+9",
      orderNumber: "202501010101010000",
      items: [
        { name: "ファンタオレンジ500ml", price: 180 },
        { name: "コーラ500ml", price: 180 },
      ],
    },
    // 可以添加更多购买历史数据
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
        <h1 className="text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
          アメニティ購入履歴
        </h1>
      </div>

      <div className="space-y-px">
        {purchases.map((purchase, index) => (
          <div
            key={purchase.id}
            className={`bg-white p-8 space-y-2 ${
              index === 0
                ? "rounded-t-lg border border-[#BBBBBB]"
                : index === purchases.length - 1
                ? "rounded-b-lg border border-t-0 border-[#BBBBBB]"
                : "border border-t-0 border-[#BBBBBB]"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-[15px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                アメニティ購入
              </span>
              <span className="text-[10px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
                {purchase.date} {purchase.time} No.{purchase.orderNumber}
              </span>
            </div>
            <div>
              <span className="text-[13px] text-[#444444] tracking-[0.06em] font-zen-kaku-gothic whitespace-pre-line">
                {purchase.items
                  .map((item) => `${item.name} ¥${item.price}`)
                  .join("\n")}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2">
        <button
          className="w-10 h-10 flex items-center justify-center rounded-full bg-[#C78C51] opacity-30"
          disabled
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 18L9 12L15 6"
              stroke="#FCFDFF"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D1CABC]">
          <span className="text-[18px] text-white tracking-[0.06em]">1</span>
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[#444444]">
          <span className="text-[18px] text-[#444444] tracking-[0.06em]">
            2
          </span>
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[#444444]">
          <span className="text-[18px] text-[#444444] tracking-[0.06em]">
            3
          </span>
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[#444444]">
          <span className="text-[18px] text-[#444444] tracking-[0.06em]">
            4
          </span>
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-[#C78C51]">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 18L15 12L9 6"
              stroke="#FCFDFF"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
