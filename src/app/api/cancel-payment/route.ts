import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { initAdmin } from "@/utils/firebase-admin";

// 设置此API路由为动态路由
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 初始化Firebase Admin
    initAdmin();
    const db = getFirestore();

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

    // 解析请求体获取锁定ID
    const { lockId } = await req.json();

    if (!lockId) {
      return NextResponse.json(
        { error: "锁定ID是必需的" },
        { status: 400 }
      );
    }

    // 验证锁定是否属于当前用户
    const lockDoc = await db.collection("reservation_locks").doc(lockId).get();

    if (!lockDoc.exists) {
      console.log(`锁定记录不存在或已被删除: ${lockId}`);
      return NextResponse.json({ message: "锁定已被清理" });
    }

    const lockData = lockDoc.data();
    if (lockData?.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: "无权删除此锁定" },
        { status: 403 }
      );
    }

    // 删除锁定记录
    await db.collection("reservation_locks").doc(lockId).delete();

    console.log(`用户取消支付，清理锁定记录: ${lockId}, 用户: ${decodedToken.uid}`);

    return NextResponse.json({ 
      message: "锁定已成功清理",
      lockId: lockId
    });

  } catch (error) {
    console.error("清理用户锁定失败:", error);
    return NextResponse.json(
      { error: "清理锁定失败" },
      { status: 500 }
    );
  }
}