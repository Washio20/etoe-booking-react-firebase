import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";

// 设置此API路由为动态路由
export const dynamic = "force-dynamic";

// 注意：当前主要依赖预约时的随机清理机制
// 此API可用于：
// 1. 管理员手动清理
// 2. 未来的定时任务调用
// 3. 系统维护时使用

export async function POST() {
  try {
    // 初始化Firebase Admin
    initAdmin();
    const db = getFirestore();

    // 获取所有过期的锁定记录
    const expiredLocksQuery = db
      .collection("reservation_locks")
      .where("expiresAt", "<=", admin.firestore.Timestamp.now());

    const expiredSnapshot = await expiredLocksQuery.get();

    if (expiredSnapshot.empty) {
      console.log("没有过期的锁定记录需要清理");
      return NextResponse.json({ 
        message: "没有过期的锁定记录", 
        deletedCount: 0 
      });
    }

    // 批量删除过期锁定
    const batch = db.batch();
    let deletedCount = 0;

    expiredSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
      console.log(`标记删除过期锁定: ${doc.id}, 用户: ${doc.data().userId}, 过期时间: ${doc.data().expiresAt.toDate()}`);
    });

    await batch.commit();

    console.log(`成功清理 ${deletedCount} 个过期的锁定记录`);
    
    return NextResponse.json({ 
      message: `成功清理 ${deletedCount} 个过期锁定`, 
      deletedCount 
    });

  } catch (error) {
    console.error("清理过期锁定失败:", error);
    return NextResponse.json(
      { error: "清理过期锁定失败" },
      { status: 500 }
    );
  }
}

// 允许GET请求用于健康检查
export async function GET() {
  return NextResponse.json({ 
    message: "过期锁定清理服务运行中",
    timestamp: new Date().toISOString()
  });
}