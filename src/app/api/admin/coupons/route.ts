import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 检查是否为管理员用户
async function isAdmin(idToken: string): Promise<boolean> {
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const user = await getAuth().getUser(decodedToken.uid);
    
    // 检查自定义声明中的admin字段
    const customClaims = (await getAuth().getUser(user.uid)).customClaims || {};
    return !!customClaims.admin;
  } catch (error) {
    console.error("Admin verification error:", error);
    return false;
  }
}

// 获取优惠券列表
export async function GET(req: Request) {
  try {
    // 初始化Firebase Admin
    initAdmin();
    
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
    
    // 验证是否为管理员
    if (!(await isAdmin(idToken))) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }
    
    // 获取Firestore实例
    const db = getFirestore();
    
    // 查询所有优惠券，按创建时间降序排列
    const couponsSnapshot = await db
      .collection("coupons")
      .orderBy("createdAt", "desc")
      .get();
    
    // 转换为数组
    const coupons = couponsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return NextResponse.json({ coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return NextResponse.json(
      { error: "クーポンの取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 创建新优惠券
export async function POST(req: Request) {
  try {
    // 初始化Firebase Admin
    initAdmin();
    
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
    
    // 验证是否为管理员
    if (!(await isAdmin(idToken))) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }
    
    // 获取请求体
    const couponData = await req.json();
    
    // 验证必填字段
    if (!couponData.code || !couponData.name || !couponData.discountType || !couponData.discountValue) {
      return NextResponse.json(
        { error: "必須フィールドが不足しています" },
        { status: 400 }
      );
    }
    
    // 验证折扣类型
    if (!['fixed', 'percentage'].includes(couponData.discountType)) {
      return NextResponse.json(
        { error: "無効な割引タイプです" },
        { status: 400 }
      );
    }
    
    // 验证折扣值
    if (couponData.discountType === 'percentage' && (couponData.discountValue <= 0 || couponData.discountValue > 100)) {
      return NextResponse.json(
        { error: "割引率は1%から100%の間でなければなりません" },
        { status: 400 }
      );
    }
    
    if (couponData.discountType === 'fixed' && couponData.discountValue <= 0) {
      return NextResponse.json(
        { error: "割引金額は1円以上でなければなりません" },
        { status: 400 }
      );
    }
    
    // 验证日期
    if (!couponData.validFrom || !couponData.validTo) {
      return NextResponse.json(
        { error: "有効期間を設定してください" },
        { status: 400 }
      );
    }
    
    // 获取Firestore实例
    const db = getFirestore();
    
    // 检查优惠券码是否已存在
    const existingCouponQuery = await db
      .collection("coupons")
      .where("code", "==", couponData.code)
      .limit(1)
      .get();
    
    if (!existingCouponQuery.empty) {
      return NextResponse.json(
        { error: "このクーポンコードは既に使用されています" },
        { status: 400 }
      );
    }
    
    // 格式化日期
    const validFrom = new Date(couponData.validFrom);
    const validTo = new Date(couponData.validTo);
    
    if (validFrom >= validTo) {
      return NextResponse.json(
        { error: "有効期間の終了日は開始日より後でなければなりません" },
        { status: 400 }
      );
    }
    
    // 创建时间戳
    const now = admin.firestore.Timestamp.now();
    
    // 创建优惠券数据
    const newCoupon = {
      code: couponData.code,
      name: couponData.name,
      description: couponData.description || "",
      discountType: couponData.discountType,
      discountValue: Number(couponData.discountValue),
      minAmount: Number(couponData.minAmount || 0),
      maxDiscount: couponData.discountType === 'percentage' ? Number(couponData.maxDiscount || 0) : 0,
      validFrom: admin.firestore.Timestamp.fromDate(validFrom),
      validTo: admin.firestore.Timestamp.fromDate(validTo),
      usageLimit: Number(couponData.usageLimit || -1),
      perUserLimit: Number(couponData.perUserLimit || -1),
      usedCount: 0,
      isActive: couponData.isActive !== false,
      applicableRoomTypes: Array.isArray(couponData.applicableRoomTypes) ? couponData.applicableRoomTypes : [],
      applicableDaysOfWeek: Array.isArray(couponData.applicableDaysOfWeek) ? couponData.applicableDaysOfWeek : [],
      isFirstTimeOnly: couponData.isFirstTimeOnly === true,
      createdAt: now,
      updatedAt: now,
    };
    
    // 保存到数据库
    const couponRef = await db.collection("coupons").add(newCoupon);
    
    return NextResponse.json({
      success: true,
      couponId: couponRef.id,
      message: "クーポンが作成されました",
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    return NextResponse.json(
      { error: "クーポンの作成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}