import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getAuth } from "firebase-admin/auth";

// 确保Firebase Admin已初始化
initAdmin();

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 从请求头中获取认证令牌
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];

    // 验证令牌
    const auth = getAuth();
    try {
      const decodedToken = await auth.verifyIdToken(idToken);

      // 验证当前用户是否为管理员
      const isAdmin = decodedToken.admin === true;

      if (!isAdmin) {
        return NextResponse.json(
          { error: "管理者権限が必要です。" },
          { status: 403 }
        );
      }

      // 获取要设置为管理员的用户ID
      const { targetUserId } = await request.json();

      if (!targetUserId) {
        return NextResponse.json(
          { error: "ユーザーIDが必要です。" },
          { status: 400 }
        );
      }

      // 设置用户为管理员
      await auth.setCustomUserClaims(targetUserId, { admin: true });

      // 返回成功响应
      return NextResponse.json({
        success: true,
        message: "ユーザーに管理者権限を付与しました。",
      });
    } catch (error) {
      console.error("令牌验证失败:", error);
      return NextResponse.json(
        { error: "無効な認証トークンです。" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("设置管理员失败:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}

// 取消管理员权限
export async function DELETE(request: NextRequest) {
  try {
    // 从请求头中获取认证令牌
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];

    // 验证令牌
    const auth = getAuth();
    try {
      const decodedToken = await auth.verifyIdToken(idToken);

      // 验证当前用户是否为管理员
      const isAdmin = decodedToken.admin === true;

      if (!isAdmin) {
        return NextResponse.json(
          { error: "管理者権限が必要です。" },
          { status: 403 }
        );
      }

      // 获取URL参数
      const url = new URL(request.url);
      const targetUserId = url.searchParams.get("userId");

      if (!targetUserId) {
        return NextResponse.json(
          { error: "ユーザーIDが必要です。" },
          { status: 400 }
        );
      }

      // 防止自己取消自己的管理员权限
      if (targetUserId === decodedToken.uid) {
        return NextResponse.json(
          { error: "自分自身の管理者権限を削除することはできません。" },
          { status: 400 }
        );
      }

      // 取消用户的管理员权限
      await auth.setCustomUserClaims(targetUserId, { admin: false });

      // 返回成功响应
      return NextResponse.json({
        success: true,
        message: "ユーザーの管理者権限を削除しました。",
      });
    } catch (error) {
      console.error("令牌验证失败:", error);
      return NextResponse.json(
        { error: "無効な認証トークンです。" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("取消管理员权限失败:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
