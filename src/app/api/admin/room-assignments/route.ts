import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";

// 确保Firebase Admin已初始化
initAdmin();

export async function GET(req: Request) {
  try {
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

    // 检查管理员权限
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    // 获取URL参数
    const url = new URL(req.url);
    const reservationId = url.searchParams.get("reservationId");

    if (!reservationId) {
      return NextResponse.json({ error: "予約IDは必須です" }, { status: 400 });
    }

    // 获取数据库实例
    const db = getFirestore();

    // 查询指定预约ID的房间分配记录
    const assignmentsSnapshot = await db
      .collection("roomAssignments")
      .where("reservationId", "==", reservationId)
      .get();

    // 如果没有找到分配记录
    if (assignmentsSnapshot.empty) {
      return NextResponse.json({ assignments: [] });
    }

    // 将分配记录转换为数组
    const assignments = assignmentsSnapshot.docs.map((doc) => {
      return {
        id: doc.id,
        ...doc.data(),
      };
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Error fetching room assignments:", error);
    return NextResponse.json(
      { error: "部屋割り当て情報の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
