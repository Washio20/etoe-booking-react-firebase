import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";
import { Coupon } from "@/types/coupon";

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // 初始化Firebase Admin
    initAdmin();
    
    // 获取URL和优惠券码
    const url = new URL(req.url);
    const couponCode = url.searchParams.get("code");
    
    if (!couponCode) {
      return NextResponse.json(
        { error: "クーポンコードが必要です" },
        { status: 400 }
      );
    }
    
    // 获取授权头部
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "認証トークンが必要です" },
        { status: 401 }
      );
    }
    
    // 提取令牌
    const idToken = authHeader.split("Bearer ")[1];
    
    // 验证Firebase ID令牌
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Firebase token verification failed:", error);
      return NextResponse.json(
        { error: "認証トークンが無効です" },
        { status: 401 }
      );
    }
    
    // 获取用户详情
    const userId = decodedToken.uid;
    const userRecord = await getAuth().getUser(userId);
    
    // 获取Firestore实例
    const db = getFirestore();
    
    // 查询对应的优惠券
    const couponQuery = await db
      .collection("coupons")
      .where("code", "==", couponCode)
      .where("isActive", "==", true)
      .limit(1)
      .get();
    
    if (couponQuery.empty) {
      return NextResponse.json(
        { error: "無効なクーポンコードです" },
        { status: 404 }
      );
    }
    
    // 获取优惠券数据
    const couponDoc = couponQuery.docs[0];
    const coupon = { id: couponDoc.id, ...couponDoc.data() } as Coupon;
    
    // 检查优惠券是否过期
    const now = admin.firestore.Timestamp.now();
    if (coupon.validFrom > now || coupon.validTo < now) {
      return NextResponse.json(
        { error: "このクーポンは現在有効ではありません" },
        { status: 400 }
      );
    }
    
    // 检查优惠券使用次数是否达到限制
    if (coupon.usageLimit !== -1 && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json(
        { error: "このクーポンは使用回数の上限に達しました" },
        { status: 400 }
      );
    }
    
    // 检查用户是否已达到使用次数限制
    if (coupon.perUserLimit !== -1) {
      const userUsageQuery = await db
        .collection("couponUsage")
        .where("couponId", "==", coupon.id)
        .where("userId", "==", userId)
        .get();
      
      if (userUsageQuery.size >= coupon.perUserLimit) {
        return NextResponse.json(
          { error: "このクーポンは既に最大回数使用されています" },
          { status: 400 }
        );
      }
    }
    
    // 检查是否仅限首次预约使用
    if (coupon.isFirstTimeOnly) {
      const userReservationsQuery = await db
        .collection("reservations")
        .where("userId", "==", userId)
        .where("paymentStatus", "==", "paid")
        .limit(1)
        .get();
      
      if (!userReservationsQuery.empty) {
        return NextResponse.json(
          { error: "このクーポンは初回予約のみ使用可能です" },
          { status: 400 }
        );
      }
    }
    
    // 优惠券验证通过，返回优惠券信息
    return NextResponse.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscount: coupon.maxDiscount,
        applicableRoomTypes: coupon.applicableRoomTypes,
      },
    });
    
  } catch (error) {
    console.error("Error validating coupon:", error);
    return NextResponse.json(
      { error: "クーポンの検証中にエラーが発生しました" },
      { status: 500 }
    );
  }
}