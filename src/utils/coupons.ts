import Stripe from "stripe";

// Only initialize Stripe on the server side
let stripe: Stripe | null = null;
if (typeof window === "undefined" && process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
  });
}

/**
 * Synchronous coupon code format validation (only checks not empty)
 */
export function validateCouponCodeFormat(code: string): boolean {
  return code.trim() !== "";
}

/**
 * Query Stripe PromotionCode and its coupon info by code (server only)
 */
export async function getStripePromotionByCode(code: string) {
  if (!stripe) throw new Error("Stripe API can only be called on the server side");
  if (!code) return null;
  const promoList = await stripe.promotionCodes.list({
    code,
    limit: 1,
    expand: ["data.coupon"],
  });
  if (promoList.data.length === 0) return null;
  return promoList.data[0];
}

/**
 * Async validate coupon code by calling Stripe API (server only)
 * @returns true if valid, false otherwise
 */
export async function validateCouponCode(code: string): Promise<boolean> {
  if (!validateCouponCodeFormat(code)) return false;
  const promo = await getStripePromotionByCode(code);
  return !!promo;
} 