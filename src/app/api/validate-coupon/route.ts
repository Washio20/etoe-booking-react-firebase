import { NextRequest, NextResponse } from "next/server";
import { getStripePromotionByCode } from "@/utils/coupons";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ valid: false, message: "No code provided" }, { status: 400 });
  }
  try {
    const promo = await getStripePromotionByCode(code);
    if (!promo) {
      return NextResponse.json({ valid: false });
    }
    const coupon = promo.coupon;
    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        name: coupon.name,
        percent_off: coupon.percent_off,
        amount_off: coupon.amount_off,
        currency: coupon.currency,
        duration: coupon.duration,
      },
    });
  } catch (e) {
    return NextResponse.json({ valid: false, message: "Server error" }, { status: 500 });
  }
} 