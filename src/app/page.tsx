"use client";

import RoomSelection from "@/components/RoomSelection";
import Layout from "@/components/Layout";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const searchParams = useSearchParams();
  const couponCode = searchParams.get("code");

  return (
    <Layout>
      <div className="max-w-[920px] mx-auto px-4 md:px-0 py-4 md:py-8 space-y-12">
        <RoomSelection initialCouponCode={couponCode} />
      </div>
    </Layout>
  );
}
