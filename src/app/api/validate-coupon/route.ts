import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";
import { Coupon } from "@/types/coupon";

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // 初始化Firebase Admin
    initAdmin();
    
    // 获取URL和优惠券码
    const url = new URL(req.url);
    const couponCode = url.searchParams.get("code");
    
    if (!couponCode) {
      return NextResponse.json(
        { error: "クーポンコードが必要です" },
        { status: 400 }
      );
    }
    
    // 获取预约信息参数
    const roomType = url.searchParams.get("roomType");
    const roomPrice = url.searchParams.get("roomPrice");
    const slowRoomPrice = url.searchParams.get("slowRoomPrice");
    const hasSlowRoomPlan = url.searchParams.get("hasSlowRoomPlan") === "true";
    
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
    
    // 获取用户详情
    const userId = decodedToken.uid;
    const userRecord = await getAuth().getUser(userId);
    
    // 获取Firestore实例
    const db = getFirestore();
    
    // 查询对应的优惠券
    const couponQuery = await db
      .collection("coupons")
      .where("code", "==", couponCode)
      .where("isActive", "==", true)
      .limit(1)
      .get();
    
    if (couponQuery.empty) {
      return NextResponse.json(
        { error: "無効なクーポンコードです" },
        { status: 404 }
      );
    }
    
    // 获取优惠券数据
    const couponDoc = couponQuery.docs[0];
    const coupon = { id: couponDoc.id, ...couponDoc.data() } as Coupon;
    
    // 检查优惠券是否过期
    const now = admin.firestore.Timestamp.now();
    if (coupon.validFrom > now || coupon.validTo < now) {
      return NextResponse.json(
        { error: "このクーポンは現在有効ではありません" },
        { status: 400 }
      );
    }
    
    // 检查优惠券使用次数是否达到限制
    if (coupon.usageLimit !== -1 && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json(
        { error: "このクーポンは使用回数の上限に達しました" },
        { status: 400 }
      );
    }
    
    // 检查用户是否已达到使用次数限制
    if (coupon.perUserLimit !== -1) {
      const userUsageQuery = await db
        .collection("couponUsage")
        .where("couponId", "==", coupon.id)
        .where("userId", "==", userId)
        .where("status", "==", "completed") // 只统计已完成的使用记录
        .get();
      
      if (userUsageQuery.size >= coupon.perUserLimit) {
        return NextResponse.json(
          { error: "このクーポンは既に最大回数使用されています" },
          { status: 400 }
        );
      }
    }
    
    // 检查是否仅限首次预约使用
    if (coupon.isFirstTimeOnly) {
      const userReservationsQuery = await db
        .collection("reservations")
        .where("userId", "==", userId)
        .where("paymentStatus", "==", "paid")
        .limit(1)
        .get();
      
      if (!userReservationsQuery.empty) {
        return NextResponse.json(
          { error: "このクーポンは初回予約のみ使用可能です" },
          { status: 400 }
        );
      }
    }
    
    // 检查优惠券适用性和计算折扣详情
    if (roomType && roomPrice) {
      const roomPriceNum = parseInt(roomPrice);
      const slowRoomPriceNum = slowRoomPrice ? parseInt(slowRoomPrice) : 0;
      
      // 计算可适用的项目和折扣金额
      let canApply = false;
      let totalDiscount = 0;
      let roomDiscount = 0;
      let slowRoomDiscount = 0;
      const applicableItems: string[] = [];
      
      // 检查优惠券是否适用于当前房间类型
      const isApplicableToRoom = coupon.applicableRoomTypes.length === 0 || 
                                coupon.applicableRoomTypes.includes(roomType);
      
      // 检查优惠券是否适用于slow room
      const isApplicableToSlowRoom = coupon.applicableRoomTypes.length === 0 || 
                                    coupon.applicableRoomTypes.includes('slow_room');
      
      // 纯スロールーム预约
      if (roomType === 'slow_room') {
        if (isApplicableToRoom) {
          if (coupon.discountType === 'fixed') {
            roomDiscount = Math.min(coupon.discountValue, roomPriceNum);
          } else {
            roomDiscount = Math.floor(roomPriceNum * (coupon.discountValue / 100));
            if (coupon.maxDiscount && coupon.maxDiscount > 0) {
              roomDiscount = Math.min(roomDiscount, coupon.maxDiscount);
            }
          }
          if (roomDiscount > 0) {
            applicableItems.push('スロールーム');
            canApply = true;
          }
        }
      }
      // sauna+スロールーム套餐预约
      else if (hasSlowRoomPlan && slowRoomPriceNum > 0) {
        // 检查是否适用于主房间
        if (isApplicableToRoom) {
          if (coupon.discountType === 'fixed') {
            roomDiscount = Math.min(coupon.discountValue, roomPriceNum);
          } else {
            roomDiscount = Math.floor(roomPriceNum * (coupon.discountValue / 100));
            if (coupon.maxDiscount && coupon.maxDiscount > 0) {
              roomDiscount = Math.min(roomDiscount, coupon.maxDiscount);
            }
          }
          if (roomDiscount > 0) {
            applicableItems.push(getRoomTypeDisplayName(roomType));
            canApply = true;
          }
        }

        // 检查是否适用于slow room
        if (isApplicableToSlowRoom) {
          if (coupon.discountType === 'fixed') {
            // 对于固定金额折扣，如果已经对主房间应用了折扣，则不再对slow room应用
            if (roomDiscount === 0) {
              slowRoomDiscount = Math.min(coupon.discountValue, slowRoomPriceNum + 1000); // +1000是因为套餐折扣
            }
          } else {
            // 对于百分比折扣，只对slow room的原价部分应用折扣
            const slowRoomOriginalPrice = slowRoomPriceNum + 1000; // 恢复套餐折扣前的价格
            slowRoomDiscount = Math.floor(slowRoomOriginalPrice * (coupon.discountValue / 100));
            if (coupon.maxDiscount && coupon.maxDiscount > 0) {
              slowRoomDiscount = Math.min(slowRoomDiscount, coupon.maxDiscount);
            }
          }
          if (slowRoomDiscount > 0) {
            applicableItems.push('スロールーム');
            canApply = true;
          }
        }
      }
      // 单独sauna预约或サウナスイート预约
      else {
        if (isApplicableToRoom) {
          if (coupon.discountType === 'fixed') {
            roomDiscount = Math.min(coupon.discountValue, roomPriceNum);
          } else {
            roomDiscount = Math.floor(roomPriceNum * (coupon.discountValue / 100));
            if (coupon.maxDiscount && coupon.maxDiscount > 0) {
              roomDiscount = Math.min(roomDiscount, coupon.maxDiscount);
            }
          }
          if (roomDiscount > 0) {
            applicableItems.push(getRoomTypeDisplayName(roomType));
            canApply = true;
          }
        }
      }
      
      totalDiscount = roomDiscount + slowRoomDiscount;
      
      // 检查最低订单金额
      if (canApply && coupon.minAmount > 0) {
        const totalAmount = roomPriceNum + slowRoomPriceNum;
        if (totalAmount < coupon.minAmount) {
          return NextResponse.json(
            { error: `このクーポンは${coupon.minAmount.toLocaleString()}円以上のご注文で使用可能です` },
            { status: 400 }
          );
        }
      }
      
      // 如果没有可适用的项目
      if (!canApply || applicableItems.length === 0) {
        return NextResponse.json(
          { error: "このクーポンは現在の予約には適用できません" },
          { status: 400 }
        );
      }
      
      // 添加折扣详情到响应中
      return NextResponse.json({
        success: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          maxDiscount: coupon.maxDiscount,
          applicableRoomTypes: coupon.applicableRoomTypes,
        },
        discountBreakdown: {
          totalDiscount,
          roomDiscount,
          slowRoomDiscount,
          applicableItems
        }
      });
    }
    
    // 如果没有提供预约信息，只返回基本的优惠券验证结果
    return NextResponse.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscount: coupon.maxDiscount,
        applicableRoomTypes: coupon.applicableRoomTypes,
      },
    });
    
  } catch (error) {
    console.error("Error validating coupon:", error);
    return NextResponse.json(
      { error: "クーポンの検証中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 获取房间类型显示名称的辅助函数
function getRoomTypeDisplayName(roomType: string): string {
  switch (roomType) {
    case 'tototo': return 'TOTOTO';
    case 'fuuu': return 'FUUU';
    case 'zabuun': return 'ZABUUN';
    case 'toron': return 'TORON';
    case 'sauna_suite': return 'サウナスイート';
    case 'slow_room': return 'スロールーム';
    default: return roomType;
  }
}