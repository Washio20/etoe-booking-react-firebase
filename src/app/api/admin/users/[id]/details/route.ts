import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { User } from "@/types/user";
import { Reservation } from "@/types/reservation";
import { CouponUsage } from "@/types/coupon";

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

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 初始化Firebase Admin
    initAdmin();
    
    // 获取用户ID
    const userId = params.id;
    
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
    
    // 获取Firestore和Auth实例
    const db = getFirestore();
    const auth = getAuth();
    
    try {
      // 获取用户基本信息
      const userRecord = await auth.getUser(userId);
      const userProfileDoc = await db.collection("users").doc(userId).get();
      const profileData = userProfileDoc.exists ? userProfileDoc.data() : {};
      
      const userData: User = {
        uid: userRecord.uid,
        email: userRecord.email || "",
        emailVerified: userRecord.emailVerified,
        fullName: profileData?.fullName || "",
        gender: profileData?.gender,
        birthdate: profileData?.birthdate,
        phone: profileData?.phone,
        createdAt: userRecord.metadata.creationTime,
        lastLogin: userRecord.metadata.lastSignInTime,
        updatedAt: profileData?.updatedAt,
        isAdmin: userRecord.customClaims?.admin === true,
      };
      
      // 获取用户预约记录
      const reservationsSnapshot = await db.collection("reservations")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
      
      const reservations = reservationsSnapshot.docs.map(doc => {
        return { id: doc.id, ...doc.data() } as Reservation;
      });
      
      // 获取用户的优惠券使用记录
      const couponUsageSnapshot = await db.collection("couponUsage")
        .where("userId", "==", userId)
        .orderBy("usedAt", "desc")
        .get();
        
      const couponUsages = await Promise.all(couponUsageSnapshot.docs.map(async (doc) => {
        const usageData = doc.data() as CouponUsage;
        
        // 获取优惠券信息
        let couponName = "";
        let couponCode = "";
        
        try {
          const couponDoc = await db.collection("coupons").doc(usageData.couponId).get();
          if (couponDoc.exists) {
            const couponData = couponDoc.data();
            couponName = couponData?.name || "";
            couponCode = couponData?.code || "";
          }
        } catch (error) {
          console.error("获取优惠券信息失败:", error);
        }
        
        return {
          ...usageData,
          couponName,
          couponCode
        };
      }));
      
      return NextResponse.json({
        user: userData,
        reservations,
        couponUsages
      });
      
    } catch (error) {
      console.error("Error fetching user details:", error);
      return NextResponse.json(
        { error: "ユーザー情報の取得中にエラーが発生しました" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "リクエスト処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic"; 