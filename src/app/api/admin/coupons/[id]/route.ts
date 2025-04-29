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

// 获取单个优惠券详情
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const couponId = params.id;

  try {
    // 初始化Firebase Admin
    initAdmin();
    
    // 获取授权头部
    const authHeader = request.headers.get("authorization");
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

    // 检查是否为管理员
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return NextResponse.json(
        { error: "管理者権限がありません" },
        { status: 403 }
      );
    }

    // 获取优惠券详情
    const db = getFirestore();
    const couponDoc = await db
      .collection("coupons")
      .doc(couponId)
      .get();

    if (!couponDoc.exists) {
      return NextResponse.json(
        { error: "クーポンデータが見つかりません" },
        { status: 404 }
      );
    }

    // 格式化数据
    const couponData = couponDoc.data();
    const coupon = {
      id: couponDoc.id,
      ...couponData,
    };

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error("Error retrieving coupon:", error);
    return NextResponse.json(
      { error: "クーポンの取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 更新优惠券(完整更新)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const couponId = params.id;

  try {
    // 初始化Firebase Admin
    initAdmin();
    
    // 获取授权头部
    const authHeader = request.headers.get("authorization");
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

    // 获取请求体数据
    const formData = await request.json();
    
    // 验证必要字段
    const requiredFields = ['code', 'name', 'discountType', 'discountValue', 'validFrom', 'validTo'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        return NextResponse.json(
          { error: `${field}フィールドは必須です` },
          { status: 400 }
        );
      }
    }

    // 获取Firestore实例
    const db = getFirestore();
    
    // 检查优惠券是否存在
    const couponRef = db.collection("coupons").doc(couponId);
    const couponDoc = await couponRef.get();
    
    if (!couponDoc.exists) {
      return NextResponse.json(
        { error: "クーポンが見つかりません" },
        { status: 404 }
      );
    }
    
    // 格式化日期时间字段
    let validFrom, validTo;
    try {
      validFrom = new Date(formData.validFrom);
      validTo = new Date(formData.validTo);
      
      if (isNaN(validFrom.getTime()) || isNaN(validTo.getTime())) {
        return NextResponse.json(
          { error: "無効な日付形式です" },
          { status: 400 }
        );
      }
      
      if (validFrom > validTo) {
        return NextResponse.json(
          { error: "開始日が終了日より後になっています" },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("Date parsing error:", error);
      return NextResponse.json(
        { error: "日付の解析エラー" },
        { status: 400 }
      );
    }
    
    // 准备更新数据
    const updateData = {
      code: formData.code,
      name: formData.name,
      description: formData.description || "",
      discountType: formData.discountType,
      discountValue: Number(formData.discountValue),
      minAmount: Number(formData.minAmount || 0),
      maxDiscount: Number(formData.maxDiscount || 0),
      validFrom: admin.firestore.Timestamp.fromDate(validFrom),
      validTo: admin.firestore.Timestamp.fromDate(validTo),
      usageLimit: Number(formData.usageLimit || -1),
      perUserLimit: Number(formData.perUserLimit || -1),
      isActive: formData.isActive === true,
      applicableRoomTypes: formData.applicableRoomTypes || [],
      isFirstTimeOnly: formData.isFirstTimeOnly === true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // 执行更新
    await couponRef.set(updateData, { merge: true });
    
    return NextResponse.json({
      success: true,
      message: "クーポンが正常に更新されました",
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return NextResponse.json(
      { error: "クーポンの更新中にエラーが発生しました" },
      { status: 500 }
    );
  }
}