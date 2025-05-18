import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";

// 确保Firebase Admin已初始化
initAdmin();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reservationData } = body;

    if (!reservationData) {
      return NextResponse.json(
        { error: "预约数据不能为空" },
        { status: 400 }
      );
    }

    // 在函数内部获取Firestore实例
    const db = admin.firestore();
    
    // 使用Admin SDK将预约信息存储到Firestore
    const docRef = await db.collection("tempReservations").add({
      reservationData: JSON.stringify(reservationData),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
    });

    // 返回成功响应和文档ID
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error("Failed to save temporary reservation:", error);
    return NextResponse.json(
      { error: "保存临时预约失败" },
      { status: 500 }
    );
  }
} 