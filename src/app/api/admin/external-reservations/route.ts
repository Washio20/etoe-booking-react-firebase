import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";

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
    
    // 获取URL参数
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    
    // 查询外部预约记录，按创建时间降序排列
    const reservationsQuery = db
      .collection("externalReservations")
      .orderBy("createdAt", "desc")
      .limit(limit);
    
    const reservationsSnapshot = await reservationsQuery.get();
    
    // 转换为数组，包含文档ID
    const reservations = reservationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 获取总数（用于分页）
    const totalCountSnapshot = await db.collection("externalReservations").get();
    const totalCount = totalCountSnapshot.size;
    
    return NextResponse.json({
      success: true,
      reservations,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: reservations.length === limit
      }
    });
    
  } catch (error) {
    console.error("Error fetching external reservations:", error);
    return NextResponse.json(
      { error: "外部予約データの取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}