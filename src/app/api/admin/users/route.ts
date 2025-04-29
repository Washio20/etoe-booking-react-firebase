import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { User } from "@/types/user";

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
    
    // 获取查询参数
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    
    // 获取Firestore和Auth实例
    const db = getFirestore();
    const auth = getAuth();
    
    // 获取所有用户（最多获取1000个用户）
    const userRecords = await auth.listUsers(1000);
    
    // 并行获取所有用户的Firestore数据
    const userIds = userRecords.users.map(user => user.uid);
    const userProfilesPromises = userIds.map(uid => 
      db.collection("users").doc(uid).get()
    );
    
    const userProfiles = await Promise.all(userProfilesPromises);
    
    // 合并Auth信息和Firestore信息
    const usersData = userRecords.users.map((authUser, index) => {
      const profileDoc = userProfiles[index];
      const profileData = profileDoc.exists ? profileDoc.data() : {};
      
      return {
        uid: authUser.uid,
        email: authUser.email,
        emailVerified: authUser.emailVerified,
        fullName: profileData?.fullName,
        gender: profileData?.gender,
        birthdate: profileData?.birthdate,
        phone: profileData?.phone,
        createdAt: authUser.metadata.creationTime,
        lastLogin: authUser.metadata.lastSignInTime,
        updatedAt: profileData?.updatedAt,
        isAdmin: authUser.customClaims?.admin === true,
      };
    });
    
    // 如果有邮箱筛选参数，进行过滤
    let filteredUsers = usersData;
    if (email) {
      const searchTerm = email.toLowerCase();
      filteredUsers = usersData.filter(user => 
        user.email?.toLowerCase().includes(searchTerm) || 
        user.fullName?.toLowerCase().includes(searchTerm)
      );
    }
    
    return NextResponse.json({
      users: filteredUsers,
      totalCount: filteredUsers.length,
    });
    
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "ユーザー情報の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic"; 