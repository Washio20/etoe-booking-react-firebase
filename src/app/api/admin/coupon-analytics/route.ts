import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";

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
    
    // 获取所有优惠券
    const couponsSnapshot = await db.collection("coupons").get();
    
    // 获取所有优惠券使用记录
    const couponUsageSnapshot = await db.collection("couponUsage").get();
    
    // 总优惠券数
    const totalCoupons = couponsSnapshot.size;
    
    // 当前时间
    const now = admin.firestore.Timestamp.now();
    
    // 活跃优惠券数（未过期且有效）
    const activeCoupons = couponsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.isActive && data.validTo > now;
    }).length;
    
    // 已使用优惠券数
    const usedCoupons = couponUsageSnapshot.size;
    
    // 总折扣金额
    let totalDiscount = 0;
    couponUsageSnapshot.forEach(doc => {
      const data = doc.data();
      totalDiscount += data.discountAmount || 0;
    });
    
    // 按类型统计优惠券
    const couponsByType = [
      {
        name: "固定金額割引",
        value: couponsSnapshot.docs.filter(doc => doc.data().discountType === "fixed").length
      },
      {
        name: "パーセント割引",
        value: couponsSnapshot.docs.filter(doc => doc.data().discountType === "percentage").length
      }
    ];
    
    // 统计每个优惠券的使用情况
    const couponUsageMap = new Map();
    couponUsageSnapshot.forEach(doc => {
      const data = doc.data();
      const couponId = data.couponId;
      
      if (!couponUsageMap.has(couponId)) {
        couponUsageMap.set(couponId, {
          usedCount: 0,
          totalDiscount: 0
        });
      }
      
      const stats = couponUsageMap.get(couponId);
      stats.usedCount += 1;
      stats.totalDiscount += data.discountAmount || 0;
    });
    
    // 获取每个优惠券的详细信息
    const couponDetailsMap = new Map();
    couponsSnapshot.forEach(doc => {
      couponDetailsMap.set(doc.id, {
        id: doc.id,
        ...doc.data()
      });
    });
    
    // 计算热门优惠券
    const topCoupons = Array.from(couponUsageMap.entries())
      .map(([couponId, stats]) => {
        const coupon = couponDetailsMap.get(couponId);
        return {
          code: coupon ? coupon.code : "Unknown",
          name: coupon ? coupon.name : "Unknown",
          usedCount: stats.usedCount,
          totalDiscount: stats.totalDiscount
        };
      })
      .sort((a, b) => b.usedCount - a.usedCount)
      .slice(0, 10);
    
    // 按月统计使用情况
    const usageByMonthMap = new Map();
    couponUsageSnapshot.forEach(doc => {
      const data = doc.data();
      const usedAt = data.usedAt ? data.usedAt.toDate() : new Date();
      const monthKey = `${usedAt.getFullYear()}-${String(usedAt.getMonth() + 1).padStart(2, '0')}`;
      
      if (!usageByMonthMap.has(monthKey)) {
        usageByMonthMap.set(monthKey, {
          month: monthKey,
          count: 0
        });
      }
      
      const monthData = usageByMonthMap.get(monthKey);
      monthData.count += 1;
    });
    
    // 排序并转换为数组
    const usageByMonth = Array.from(usageByMonthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month));
    
    return NextResponse.json({
      totalCoupons,
      activeCoupons,
      usedCoupons,
      totalDiscount,
      couponsByType,
      topCoupons,
      usageByMonth
    });
  } catch (error) {
    console.error("Error fetching coupon analytics:", error);
    return NextResponse.json(
      { error: "クーポン分析データの取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}