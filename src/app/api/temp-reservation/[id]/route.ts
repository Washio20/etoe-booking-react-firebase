import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";

// 确保Firebase Admin已初始化
initAdmin();

// 获取临时预约数据
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: "预约ID不能为空" },
        { status: 400 }
      );
    }

    // 在函数内部获取Firestore实例
    const db = admin.firestore();
    const docRef = db.collection("tempReservations").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "找不到预约数据" },
        { status: 404 }
      );
    }

    const data = docSnap.data();
    
    // 检查是否过期
    const expiresAt = data?.expiresAt;
    if (expiresAt && expiresAt.toDate() <= new Date()) {
      return NextResponse.json(
        { error: "预约数据已过期" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      reservationData: data?.reservationData,
    });
  } catch (error) {
    console.error("Failed to fetch temporary reservation:", error);
    return NextResponse.json(
      { error: "获取临时预约失败" },
      { status: 500 }
    );
  }
}

// 删除临时预约数据
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: "预约ID不能为空" },
        { status: 400 }
      );
    }

    // 在函数内部获取Firestore实例
    const db = admin.firestore();
    
    // 检查文档是否存在
    const docRef = db.collection("tempReservations").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "找不到预约数据" },
        { status: 404 }
      );
    }

    // 删除文档
    await docRef.delete();

    return NextResponse.json({
      success: true,
      message: "临时预约已成功删除",
    });
  } catch (error) {
    console.error("Failed to delete temporary reservation:", error);
    return NextResponse.json(
      { error: "删除临时预约失败" },
      { status: 500 }
    );
  }
} 