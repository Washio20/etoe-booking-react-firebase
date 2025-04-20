import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// 确保Firebase Admin已初始化
initAdmin();

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 定义联系表单数据类型
interface ContactData {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  content: string;
  status: string;
  userId?: string | null;
  userEmail?: string;
  adminComment?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  handledBy?: string;
  handledAt?: Date;
  [key: string]: any; // 允许其他字段
}

// 获取联系表单数据
export async function GET(request: NextRequest) {
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

      // 检查用户权限，这里应该根据实际情况设置管理员权限
      // 示例：检查自定义声明或者特定的用户ID
      // 实际应用中，您可能需要在Firestore中设置一个管理员用户集合
      // 这里简单地检查一个自定义声明
      const isAdmin = decodedToken.admin === true;

      if (!isAdmin) {
        return NextResponse.json(
          { error: "管理者権限が必要です。" },
          { status: 403 }
        );
      }

      // 查询联系表单数据
      const db = getFirestore();
      const contactsRef = db.collection("contacts");

      // 获取分页参数
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const startAfter = url.searchParams.get("startAfter") || null;

      // 构建查询
      let query = contactsRef.orderBy("createdAt", "desc").limit(limit);

      // 如果有startAfter参数，用于分页
      if (startAfter) {
        const startAfterDoc = await db
          .collection("contacts")
          .doc(startAfter)
          .get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
        }
      }

      // 执行查询
      const snapshot = await query.get();

      // 格式化结果
      const contacts: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        contacts.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || null,
          updatedAt: data.updatedAt?.toDate() || null,
        });
      });

      // 返回结果
      return NextResponse.json({
        contacts,
        lastDoc: contacts.length > 0 ? contacts[contacts.length - 1].id : null,
        hasMore: contacts.length === limit,
      });
    } catch (error) {
      console.error("令牌验证失败:", error);
      return NextResponse.json(
        { error: "無効な認証トークンです。" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("获取联系表单数据失败:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}

// 处理联系表单状态更新
export async function PATCH(request: NextRequest) {
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

      // 检查用户权限
      const isAdmin = decodedToken.admin === true;

      if (!isAdmin) {
        return NextResponse.json(
          { error: "管理者権限が必要です。" },
          { status: 403 }
        );
      }

      // 获取请求数据
      const data = await request.json();
      const { contactId, status, adminComment } = data;

      if (!contactId || !status) {
        return NextResponse.json(
          { error: "必須パラメータが不足しています。" },
          { status: 400 }
        );
      }

      // 更新联系表单状态
      const db = getFirestore();
      const contactRef = db.collection("contacts").doc(contactId);

      // 检查文档是否存在
      const contactDoc = await contactRef.get();
      if (!contactDoc.exists) {
        return NextResponse.json(
          { error: "指定されたお問い合わせが見つかりません。" },
          { status: 404 }
        );
      }

      // 更新状态
      await contactRef.update({
        status,
        adminComment: adminComment || null,
        updatedAt: new Date(),
        handledBy: decodedToken.uid,
        handledAt: new Date(),
      });

      return NextResponse.json({ success: true, contactId });
    } catch (error) {
      console.error("令牌验证失败:", error);
      return NextResponse.json(
        { error: "無効な認証トークンです。" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("更新联系表单状态失败:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
