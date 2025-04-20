import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// 确保Firebase Admin已初始化
initAdmin();

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// 提交联系表单
export async function POST(request: NextRequest) {
  try {
    // 获取请求数据
    const formData = await request.json();
    const { name, email, phone, title, content } = formData;

    // 验证必填字段
    if (!name || !email || !phone || !title || !content) {
      return NextResponse.json(
        { error: "必須項目を入力してください。" },
        { status: 400 }
      );
    }

    // 可选：验证用户身份
    let userId = null;
    let userVerified = false;

    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.split("Bearer ")[1];
      try {
        const auth = getAuth();
        const decodedToken = await auth.verifyIdToken(idToken);
        userId = decodedToken.uid;
        userVerified = true;
      } catch (error) {
        console.warn("トークン検証に失敗しましたが、匿名で続行します:", error);
      }
    }

    // 创建联系表单文档
    const db = getFirestore();
    const contactsRef = db.collection("contacts");

    const contactData = {
      name,
      email,
      phone,
      title,
      content,
      status: "pending", // 初始状态：待处理
      userId: userId, // 如果已验证用户，存储用户ID
      userVerified, // 标记用户是否已验证
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 保存到Firestore
    const docRef = await contactsRef.add(contactData);

    return NextResponse.json({
      success: true,
      contactId: docRef.id,
      message: "お問い合わせが正常に送信されました。",
    });
  } catch (error) {
    console.error("联系表单提交失败:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。後でもう一度お試しください。" },
      { status: 500 }
    );
  }
}
