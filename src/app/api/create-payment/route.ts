import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import admin from "firebase-admin";
import { Coupon } from "@/types/coupon";
import { SLOW_ROOM_MAPPING } from "@/types/room";
import { convertToDate, parseReservationDate } from "@/utils/date";

// 纯sauna房间类型列表
const PURE_SAUNA_ROOM_TYPES = ["tototo", "fuuu", "zabuun", "toron"];

// 标准价格配置（可根据实际情况调整）
const ROOM_BASE_PRICES: Record<string, number> = {
  tototo: 8000,
  fuuu: 8500,
  zabuun: 9000,
  toron: 9500,
  sauna_suite: 12000,
  slow_room: 8900,
};

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic";

// JST (UTC+9) 偏移量，用于在UTC时间与日本当地日历日之间转换
const JST_OFFSET_MINUTES = 9 * 60;

// 清扫缓冲时间（分钟）
const CLEANING_BUFFER_MINUTES = 20;
const CLEANING_BUFFER_MS = CLEANING_BUFFER_MINUTES * 60 * 1000;

// 根据预约数据推导出“日本时间的预约日期”
function deriveTargetDate(reservation: any): {
  year: number;
  month: number;
  day: number;
  source: string;
} | null {
  const extract = (value: string | null | undefined, source: string) => {
    if (!value) return null;
    const parsed = parseReservationDate(value);
    if (parsed) {
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
        source,
      };
    }
    return null;
  };

  // 优先使用UI直接展示的日期（避免时区歧义）
  const displayDate = extract(reservation?.displayDate, "displayDate");
  if (displayDate) return displayDate;

  const dateField = extract(reservation?.date, "date");
  if (dateField) return dateField;

  // 退而求其次：使用bookingDate或startDateTime（ISO字符串）
  const isoCandidate = reservation?.bookingDate || reservation?.startDateTime;
  if (isoCandidate) {
    const isoDate = convertToDate(isoCandidate);
    if (isoDate) {
      // 转换成JST对应的日历日
      const jstMillis = isoDate.getTime() + JST_OFFSET_MINUTES * 60 * 1000;
      const jstDate = new Date(jstMillis);
      return {
        year: jstDate.getUTCFullYear(),
        month: jstDate.getUTCMonth() + 1,
        day: jstDate.getUTCDate(),
        source: reservation?.bookingDate ? "bookingDate" : "startDateTime",
      };
    }
  }

  return null;
}

// 生成以JST为基准的一天的起止UTC时间
function createJstDayRange(year: number, month: number, day: number) {
  const startUtcMillis =
    Date.UTC(year, month - 1, day) - JST_OFFSET_MINUTES * 60 * 1000;
  const endUtcMillis =
    Date.UTC(year, month - 1, day, 23, 59, 59, 999) -
    JST_OFFSET_MINUTES * 60 * 1000;

  return {
    startOfDay: new Date(startUtcMillis),
    endOfDay: new Date(endUtcMillis),
  };
}

function parseTimeString(timeStr: string): { hour: number; minute: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return { hour, minute };
}

function createDateWithTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function parseTimeRangeToDateRange(
  timeRange: string,
  year: number,
  month: number,
  day: number
): { start: Date; end: Date } | null {
  if (!timeRange) return null;
  const parts = timeRange.split(/[～〜~\-]/);
  if (parts.length !== 2) return null;

  const startInfo = parseTimeString(parts[0].trim());
  const endInfo = parseTimeString(parts[1].trim());

  if (!startInfo || !endInfo) return null;

  const start = createDateWithTime(year, month, day, startInfo.hour, startInfo.minute);
  const end = createDateWithTime(year, month, day, endInfo.hour, endInfo.minute);

  return { start, end };
}

function rangesConflictWithCleaningBuffer(
  candidate: { start: Date; end: Date },
  existing: { start: Date; end: Date }
): boolean {
  const adjustedExistingStart = existing.start.getTime() - CLEANING_BUFFER_MS;
  const adjustedExistingEnd = existing.end.getTime() + CLEANING_BUFFER_MS;
  return (
    adjustedExistingStart < candidate.end.getTime() &&
    adjustedExistingEnd > candidate.start.getTime()
  );
}

export async function POST(req: Request) {
  // 设置时区为日本时区
  process.env.TZ = "Asia/Tokyo";
  
  // 初始化Firebase Admin
  try {
    initAdmin();
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
  }
  
  // 初始化Stripe客户端
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-03-31.basil",
  });

  // 初始化Firestore
  const db = getFirestore();

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

    // 获取用户详情
    const userRecord = await getAuth().getUser(decodedToken.uid);

    // 检查用户邮箱是否已验证
    if (!userRecord.emailVerified) {
      return NextResponse.json(
        { error: "メールアドレスの確認が必要です" },
        { status: 403 }
      );
    }

    // 解析请求体获取预约信息
    const reservation = await req.json();

    // 使用前端传递的金额，如果没有传递才使用默认计算方式
    let amount = reservation.amount;
    let appliedCouponId = reservation.couponId || null;
    let discountAmount = reservation.discountAmount || 0;
    let discountBreakdown = reservation.discountBreakdown || null;
    let skipCouponProcessing = false;

    // 如果前端已经提供了金额和折扣信息，跳过重复处理
    if (amount !== undefined && reservation.couponId && reservation.discountAmount) {
      console.log("使用前端提供的金额和折扣信息: ", {
        amount: amount,
        couponId: reservation.couponId,
        discountAmount: reservation.discountAmount,
        discountBreakdown: discountBreakdown
      });
      skipCouponProcessing = true;
    }

    // 如果没有提供金额，则计算价格
    if (amount === undefined) {

      // 获取房间类型和基础价格
      const roomType = reservation.roomType || "";
      let basePrice = 0;

      // 根据房间类型获取基础价格
      if (ROOM_BASE_PRICES[roomType]) {
        basePrice = ROOM_BASE_PRICES[roomType];
      } else {
        // 兼容旧的房型表示方式
        switch (reservation.room) {
          case "TOTOTO":
            basePrice = ROOM_BASE_PRICES.tototo;
            break;
          case "FUUU":
            basePrice = ROOM_BASE_PRICES.fuuu;
            break;
          case "ZABUUN":
            basePrice = ROOM_BASE_PRICES.zabuun;
            break;
          case "TORON":
            basePrice = ROOM_BASE_PRICES.toron;
            break;
          case "サウナスイート":
            basePrice = ROOM_BASE_PRICES.sauna_suite;
            break;
          case "スロールーム":
            basePrice = ROOM_BASE_PRICES.slow_room;
            break;
          default:
            basePrice = 8000; // 默认价格
        }
      }

      // 初始化总价为基础价格
      amount = basePrice;

      // 检查是否是纯sauna房间类型
      const isPureSaunaRoom = PURE_SAUNA_ROOM_TYPES.includes(roomType);

      // 处理套餐情况
      const needSlowRoom =
        reservation.needSlowRoom === true ||
        String(reservation.needSlowRoom).toLowerCase() === "true";

      // 获取slow room价格信息
      let slowRoomPrice = 0;
      if (needSlowRoom && reservation.slowRoomTimeRange) {
        try {
          // 如果slowRoomTimeRange是字符串，尝试解析
          const slowRoomData =
            typeof reservation.slowRoomTimeRange === "string"
              ? JSON.parse(reservation.slowRoomTimeRange)
              : reservation.slowRoomTimeRange;

          if (slowRoomData && slowRoomData.price) {
            slowRoomPrice = slowRoomData.price;
          } else if (slowRoomData && slowRoomData.hours) {
            // 在预约信息中没有直接提供价格的情况下
            console.error("slowRoomData中没有包含价格信息，但这不应该出现");
            // 使用默认价格（取中间值）
            slowRoomPrice = 7900;
          }
        } catch (e) {
          console.error("解析slow room数据时出错:", e);
          // 如果解析失败，使用默认价格（取中间值）
          slowRoomPrice = 7900;
        }
      }

      // 根据房间类型和套餐计算总价
      if (roomType === "slow_room" || roomType === "sauna_suite") {
        // 如果本身就是slow room或sauna suite，不应用套餐逻辑
        amount = basePrice;
      } else if (isPureSaunaRoom && needSlowRoom) {
        // 纯sauna + slow room套餐，应用1000円折扣
        amount = basePrice + (slowRoomPrice - 1000);
      }

      console.log("价格计算详情:", {
        roomType,
        basePrice,
        isPureSaunaRoom,
        needSlowRoom,
        slowRoomPrice,
        finalAmount: amount,
      });
    }

    console.log(
      `创建支付会话，金额: ${amount}円，房间类型: ${reservation.roomType}`
    );

    // ========== 添加预约冲突检查和临时锁定 ==========
    let lockDocId: string | null = null; // 用于存储锁定文档ID
    
    try {
      // 解析预约日期和时间
      let displayTimeRange = reservation.displayTimeRange || reservation.time || "";

      const derivedDate = deriveTargetDate(reservation);

      if (derivedDate && displayTimeRange && reservation.roomType) {
        const { year: targetYear, month: targetMonth, day: targetDay, source } =
          derivedDate;

        const { startOfDay, endOfDay } = createJstDayRange(
          targetYear,
          targetMonth,
          targetDay
        );

        console.log("检查预约冲突和创建锁定:", {
          roomType: reservation.roomType,
          targetDate: `${targetYear}年${targetMonth}月${targetDay}日`,
          targetDateSource: source,
          displayTimeRange: displayTimeRange,
        });

        const candidateTimeRange =
          reservation.roomType === "slow_room"
            ? parseTimeRangeToDateRange(
                displayTimeRange,
                targetYear,
                targetMonth,
                targetDay
              )
            : null;

        // 使用事务来确保原子性操作
        const result = await db.runTransaction(async (transaction) => {
          // 收集所有需要删除的过期锁定（在读操作阶段执行）
          let expiredLockRefs: admin.firestore.DocumentReference[] = [];
          
          // 0. 查询过期锁定（随机触发，避免每次都执行）
          if (Math.random() < 0.1) { // 10%概率触发清理
            try {
              const expiredQuery = db.collection("reservation_locks")
                .where("expiresAt", "<=", admin.firestore.Timestamp.now())
                .limit(50); // 限制一次清理数量

              const expiredSnapshot = await transaction.get(expiredQuery);
              expiredLockRefs = expiredSnapshot.docs.map(doc => doc.ref);
              
              if (expiredLockRefs.length > 0) {
                console.log(`准备清理 ${expiredLockRefs.length} 个过期锁定`);
              }
            } catch (cleanupError) {
              console.error("查询过期锁定失败:", cleanupError);
              // 清理失败不影响主要逻辑
            }
          }
          
          // 1. 检查是否有已确认的预约
          const reservationsRef = db.collection("reservations");
          
          console.log("日期范围查询:", {
            targetDate: `${targetYear}年${targetMonth}月${targetDay}日`,
            startOfDay: startOfDay.toISOString(),
            endOfDay: endOfDay.toISOString(),
            timezone: "JST基准(转换为UTC)"
          });
          
          const conflictQuery = reservationsRef
            .where("roomType", "==", reservation.roomType)
            .where("bookingDate", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
            .where("bookingDate", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
            .where("paymentStatus", "==", "paid");

          const conflictSnapshot = await transaction.get(conflictQuery);

          // 默认每个时间段只允许1个预约（适用于物理房间只有一个的房型）
          let maxReservationsAllowed = 1;
          
          // 在内存中进一步过滤相同的时间段
          const matchingReservations = conflictSnapshot.docs.filter((doc) => {
            const data = doc.data();

            if (reservation.roomType === "slow_room" && candidateTimeRange) {
              let reservationRange: { start: Date; end: Date } | null = null;

              if (
                data.startDateTime &&
                typeof data.startDateTime.toDate === "function" &&
                data.endDateTime &&
                typeof data.endDateTime.toDate === "function"
              ) {
                reservationRange = {
                  start: data.startDateTime.toDate(),
                  end: data.endDateTime.toDate(),
                };
              } else if (
                data.slowRoomStartDateTime &&
                typeof data.slowRoomStartDateTime.toDate === "function" &&
                data.slowRoomEndDateTime &&
                typeof data.slowRoomEndDateTime.toDate === "function"
              ) {
                reservationRange = {
                  start: data.slowRoomStartDateTime.toDate(),
                  end: data.slowRoomEndDateTime.toDate(),
                };
              } else if (data.displayTimeRange) {
                reservationRange = parseTimeRangeToDateRange(
                  data.displayTimeRange,
                  targetYear,
                  targetMonth,
                  targetDay
                );
              }

              if (reservationRange) {
                return rangesConflictWithCleaningBuffer(
                  candidateTimeRange,
                  reservationRange
                );
              }
            }

            return data.displayTimeRange === displayTimeRange;
          });

          if (reservation.roomType === "slow_room") {
            // Slow room 可能有多个物理房间，需根据配置和dailyInventory确定最大预约数
            const formattedDate = `${targetYear.toString().padStart(4, "0")}-${targetMonth
              .toString()
              .padStart(2, "0")}-${targetDay.toString().padStart(2, "0")}`;

            const slowRoomIds = SLOW_ROOM_MAPPING.slow_room || [];
            const totalSlowRooms =
              Array.isArray(slowRoomIds) && slowRoomIds.length > 0
                ? slowRoomIds.length
                : 1;

            const capacityCandidates: number[] = [totalSlowRooms];

            const slowRoomConfigQuery = db
              .collection("rooms")
              .where("roomType", "==", "slow_room")
              .limit(1);

            try {
              const slowRoomConfigSnapshot = await transaction.get(
                slowRoomConfigQuery
              );
              if (!slowRoomConfigSnapshot.empty) {
                const slowRoomData = slowRoomConfigSnapshot.docs[0].data();

                if (
                  typeof slowRoomData?.maxReservations === "number" &&
                  Number.isFinite(slowRoomData.maxReservations)
                ) {
                  capacityCandidates.push(slowRoomData.maxReservations);
                }

                if (
                  slowRoomData?.dailyInventory &&
                  typeof slowRoomData.dailyInventory === "object"
                ) {
                  const dailyValue =
                    slowRoomData.dailyInventory[formattedDate];
                  if (
                    typeof dailyValue === "number" &&
                    Number.isFinite(dailyValue)
                  ) {
                    capacityCandidates.push(dailyValue);
                  }
                }
              }
            } catch (configError) {
              console.error("获取slow room配置失败，使用默认物理房间数量:", configError);
            }

            const validCapacities = capacityCandidates.filter(
              (value) => Number.isFinite(value) && value >= 0
            );
            if (validCapacities.length > 0) {
              maxReservationsAllowed = Math.min(...validCapacities);
            } else {
              maxReservationsAllowed = totalSlowRooms;
            }
          }

          // Slow room的最大预约数可能大于1，其余房型维持默认1
          if (matchingReservations.length >= maxReservationsAllowed) {
            console.error("预约冲突检测：发现重复预约", {
              roomType: reservation.roomType,
              targetDate: `${targetYear}年${targetMonth}月${targetDay}日`,
              displayTimeRange: displayTimeRange,
              exactMatches: matchingReservations.length,
              totalQueryResults: conflictSnapshot.size,
              maxReservationsAllowed,
            });
            throw new Error("CONFLICT_EXISTING_RESERVATION");
          }

          // 2. 检查是否有未过期的锁定
          const locksRef = db.collection("reservation_locks");
          const lockQuery = locksRef
            .where("roomType", "==", reservation.roomType)
            .where("bookingDate", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
            .where("bookingDate", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
            .where("displayTimeRange", "==", displayTimeRange)
            .where("expiresAt", ">", admin.firestore.Timestamp.now());

          const lockSnapshot = await transaction.get(lockQuery);

          const activeLockDocs = lockSnapshot.docs;
          const conflictingLockDocs = activeLockDocs.filter((doc) => {
            const lockData = doc.data();
            if (
              reservation.roomType === "slow_room" &&
              candidateTimeRange &&
              lockData.displayTimeRange
            ) {
              const lockRange = parseTimeRangeToDateRange(
                lockData.displayTimeRange,
                targetYear,
                targetMonth,
                targetDay
              );
              if (lockRange) {
                return rangesConflictWithCleaningBuffer(
                  candidateTimeRange,
                  lockRange
                );
              }
            }
            return lockData.displayTimeRange === displayTimeRange;
          });

          if (!lockSnapshot.empty) {
            // 检查锁定是否属于当前用户
            const otherUserLocks = conflictingLockDocs.filter(
              doc => doc.data().userId !== userRecord.uid
            );

            const totalActiveLocks = conflictingLockDocs.length;

            if (
              otherUserLocks.length > 0 &&
              matchingReservations.length + totalActiveLocks >= maxReservationsAllowed
            ) {
              console.error("预约锁定检测：时间段已被锁定", {
                roomType: reservation.roomType,
                date: reservation.date,
                time: displayTimeRange,
                lockedBy: otherUserLocks[0].data().userId
              });
              throw new Error("CONFLICT_LOCKED");
            }
          }

          // === 所有读操作完成，开始写操作 ===
          
          // 3. 删除过期锁定（如果有）
          if (expiredLockRefs.length > 0) {
            expiredLockRefs.forEach(ref => {
              transaction.delete(ref);
            });
            console.log(`事务中删除了 ${expiredLockRefs.length} 个过期锁定`);
          }
          
          // 4. 创建新的锁定记录（15分钟过期）
          const lockRef = locksRef.doc();
          const lockExpiry = new Date();
          lockExpiry.setMinutes(lockExpiry.getMinutes() + 15); // 15分钟过期

          // 为锁定记录创建bookingDate（使用与webhook相同的方法）
          const lockBookingDate = admin.firestore.Timestamp.fromDate(startOfDay);

          const lockData = {
            userId: userRecord.uid,
            roomType: reservation.roomType,
            bookingDate: lockBookingDate,
            displayTimeRange: displayTimeRange,
            createdAt: admin.firestore.Timestamp.now(),
            expiresAt: admin.firestore.Timestamp.fromDate(lockExpiry),
            status: "active"
          };

          transaction.set(lockRef, lockData);
          
          console.log("成功创建预约锁定:", lockRef.id);
          return lockRef.id;
        });

        lockDocId = result;
        console.log("预约冲突检查通过，已创建临时锁定:", lockDocId);

      } else {
        console.warn("预约冲突检查：缺少必要的预约信息", {
          hasDerivedDate: !!derivedDate,
          hasDisplayTimeRange: !!displayTimeRange,
          hasRoomType: !!reservation.roomType,
          rawDisplayDate: reservation.displayDate,
          rawDate: reservation.date,
          rawBookingDate: reservation.bookingDate,
        });
      }
    } catch (conflictCheckError: any) {
      console.error("预约冲突检查/锁定失败:", conflictCheckError);
      
      if (conflictCheckError.message === "CONFLICT_EXISTING_RESERVATION") {
        return NextResponse.json(
          { 
            error: "選択された時間帯はすでに予約済みです。別の時間帯をお選びください。",
            conflictDetected: true
          },
          { status: 409 }  // 409 Conflict
        );
      } else if (conflictCheckError.message === "CONFLICT_LOCKED") {
        return NextResponse.json(
          { 
            error: "選択された時間帯は他のお客様が予約手続き中です。しばらくお待ちいただくか、別の時間帯をお選びください。",
            conflictDetected: true
          },
          { status: 409 }  // 409 Conflict
        );
      }
      
      // 其他错误不应阻止用户支付，但需要记录错误
      console.error("预约冲突检查出现异常，但继续处理:", conflictCheckError);
    }
    // ========== 预约冲突检查和临时锁定结束 ==========

    // 获取应用基础URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // 解析slow room时间范围（如果有）
    let slowRoomTimeRangeStr = "";
    if (reservation.slowRoomTimeRange) {
      if (typeof reservation.slowRoomTimeRange === "string") {
        slowRoomTimeRangeStr = reservation.slowRoomTimeRange;
      } else {
        slowRoomTimeRangeStr = JSON.stringify(reservation.slowRoomTimeRange);
      }
    }

    // 添加优惠券处理
    if (!skipCouponProcessing && reservation.couponId) {
      try {
        // 获取优惠券信息
        const couponDoc = await db.collection("coupons").doc(reservation.couponId).get();
        
        if (couponDoc.exists) {
          const coupon = couponDoc.data() as Coupon;
          
          // 验证优惠券是否有效
          const now = admin.firestore.Timestamp.now();
          const isValid = coupon.isActive && 
                          coupon.validFrom <= now && 
                          coupon.validTo >= now &&
                          (coupon.usageLimit === -1 || coupon.usedCount < coupon.usageLimit);
          
          if (isValid) {
            // 验证是否适用于当前房型
            const isApplicable = coupon.applicableRoomTypes.length === 0 || 
                                coupon.applicableRoomTypes.includes(reservation.roomType);
            
            if (isApplicable) {
              // 计算折扣金额
              if (coupon.discountType === 'fixed') {
                discountAmount = Math.min(coupon.discountValue, amount);
              } else {
                // 百分比折扣
                discountAmount = Math.floor(amount * (coupon.discountValue / 100));
                if (coupon.maxDiscount && coupon.maxDiscount > 0) {
                  discountAmount = Math.min(discountAmount, coupon.maxDiscount);
                }
              }
              
              // 应用折扣
              amount -= discountAmount;
              appliedCouponId = reservation.couponId;
              
              // 移除优惠券使用记录更新，将在后面统一处理
            }
          }
        }
      } catch (error) {
        console.error("优惠券处理错误:", error);
        // 优惠券处理失败时，不应用折扣，但继续处理预约
        appliedCouponId = null;
        discountAmount = 0;
      }
    }

    // 确保金额不小于零
    amount = Math.max(0, amount);
    
    // 记录最终金额，用于调试
    console.log(`最终计算金额: ${amount}円，优惠券折扣: ${discountAmount}円`);

    // 无论是否重新计算价格，只要有优惠券ID，都更新使用次数和创建记录
    if (appliedCouponId) {
      try {
        const now = admin.firestore.Timestamp.now();
        
        // 移除优惠券使用次数更新逻辑，只有在支付成功后才更新使用次数
        // await db.collection("coupons").doc(appliedCouponId).update({
        //   usedCount: admin.firestore.FieldValue.increment(1),
        //   updatedAt: now
        // });
        
        // 创建优惠券使用记录，添加status字段和折扣详情
        const usageRecord: any = {
          couponId: appliedCouponId,
          userId: userRecord.uid,
          reservationId: null, // 此时还没有预约ID
          discountAmount: discountAmount,
          originalAmount: amount + discountAmount,
          finalAmount: amount,
          usedAt: now,
          status: "pending" // 添加状态字段，初始状态为pending
        };
        
        // 如果有折扣详情，添加到使用记录中
        if (discountBreakdown) {
          usageRecord.discountBreakdown = discountBreakdown;
        }
        
        await db.collection("couponUsage").add(usageRecord);
        
        console.log(`已创建优惠券(${appliedCouponId})使用记录，状态为pending`);
      } catch (error) {
        console.error("创建优惠券使用记录失败:", error);
        // 创建记录失败不应影响支付流程，继续执行
      }
    }

    // 创建Stripe支付会话的metadata
    const metadata: any = {
      userId: userRecord.uid,
      reservationDate: reservation.date,
      reservationTime: reservation.time,
      roomType: reservation.roomType || reservation.room,
      plan: reservation.plan,
      price: String(amount), // 添加价格到metadata
      needSlowRoom: String(reservation.needSlowRoom), // 将布尔值转换为字符串
      slowRoomTimeRange: slowRoomTimeRangeStr, // 添加slow room时间范围
      isPureSaunaRoom: String(
        PURE_SAUNA_ROOM_TYPES.includes(reservation.roomType)
      ), // 添加是否是纯sauna房间标记
      couponId: appliedCouponId || "", // 添加优惠券ID
      discountAmount: String(discountAmount), // 添加折扣金额
      originalAmount: String(amount + discountAmount), // 添加原始金额
      lockId: lockDocId || "", // 添加锁定ID，用于支付成功后删除锁定
    };

    // 如果有折扣详情，添加到metadata中
    if (discountBreakdown) {
      metadata.discountBreakdown = JSON.stringify(discountBreakdown);
    }

    // 创建Stripe支付会话
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: `${reservation.room} - ${reservation.date} ${reservation.time}`,
              description: `予約日時: ${reservation.date} ${reservation.time}\nプラン: ${reservation.plan}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/reservation-complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment-cancelled${lockDocId ? `?lockId=${lockDocId}` : ''}`,
      customer_email: userRecord.email,
      metadata: metadata,
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("支払いセッションの作成中にエラーが発生しました:", error);
    return NextResponse.json(
      { error: "支払いセッションの作成に失敗しました" },
      { status: 500 }
    );
  }
}
