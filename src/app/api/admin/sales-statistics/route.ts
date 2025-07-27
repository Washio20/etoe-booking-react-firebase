import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/utils/firebase-admin';
import { toDate } from '@/utils/date';

// 确保Firebase Admin已初始化
initAdmin();

// 排除的工作人员用户ID
const EXCLUDED_STAFF_USER_IDS = [
  'lycapd3O2adB0dshwUHWEdQwDHv2',
  'RaSoRvReD6craTlcg5YW95hcZL33',
  'toDMjjsguBSTbjCdq4GVon5x9W93',
  'bSbaTqVEbvfL0onTVlU6LUh3A4H3'
];

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // 验证Firebase ID令牌
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error('Firebase token verification failed:', error);
      return NextResponse.json({ error: '認証トークンが無効です' }, { status: 401 });
    }
    
    // 检查管理员权限
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};
    
    if (!customClaims.admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start') || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
    const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0];

    // 创建本地时间的日期对象，不添加时区信息
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const startTimestamp = Timestamp.fromDate(startOfDay);
    const endTimestamp = Timestamp.fromDate(endOfDay);

    // 获取数据库实例
    const db = getFirestore();

    // 根据bookingDate查询预约记录
    const reservationsSnapshot = await db.collection('reservations')
      .where('bookingDate', '>=', startTimestamp)
      .where('bookingDate', '<=', endTimestamp)
      .where('paymentStatus', '==', 'paid')
      .get();

    // 获取用户信息用于リピーター统计
    const usersSnapshot = await db.collection('users').get();

    interface ReservationData {
      id: string;
      userId: string;
      userEmail: string;
      userFullName?: string;
      bookingDate: Timestamp;
      roomType: string;
      price: string | number;
      paymentStatus: string;
      cancelledAt?: Timestamp;
      [key: string]: any;
    }

    interface UserData {
      uid: string;
      email: string;
      fullName: string;
      gender?: string;
      birthdate?: string;
      createdAt?: any;
      [key: string]: any;
    }

    const reservations = reservationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ReservationData[];

    const users = usersSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    })) as UserData[];

    // 创建用户信息映射
    const userMap = new Map(users.map(user => [user.uid, user]));

    const dailySalesMap = new Map<string, { totalAmount: number; count: number }>();
    const monthlySalesMap = new Map<string, { totalAmount: number; count: number }>();
    const roomTypeSalesMap = new Map<string, { totalAmount: number; count: number }>();
    
    // 详细日销售数据 - 用于Excel导出
    const detailedDailySalesMap = new Map<string, {
      totalAmount: number;
      privateSaunaAmount: number;
      totalCount: number;
      saunaTotalCount: number; // 只计算sauna房间的总件数
      dayUseAmount: number;
      dayUseCount: number;
      dayUseOnly: number;
      roomTypeCounts: {
        tototo: number;
        fuuu: number;
        zabuun: number;
        toron: number;
        sauna_suite: number;
      };
    }>();

    reservations.forEach((reservation) => {
      // Skip cancelled reservations
      if (reservation.cancelledAt) return;

      // 使用共通函数处理日期，确保正确处理时区
      const bookingDate = toDate(reservation.bookingDate);
      if (!bookingDate) return;
      
      // 使用本地时间格式化日期，避免时区问题
      const year = bookingDate.getFullYear();
      const month = String(bookingDate.getMonth() + 1).padStart(2, '0');
      const day = String(bookingDate.getDate()).padStart(2, '0');
      const dateStr = `${year}/${month}/${day}`;
      const monthStr = `${year}/${month}`;
      const roomType = reservation.roomType;
      
      // Convert price to number (it might be stored as string)
      const amount = typeof reservation.price === 'string' 
        ? parseFloat(reservation.price) || 0 
        : reservation.price || 0;

      // Daily sales
      if (!dailySalesMap.has(dateStr)) {
        dailySalesMap.set(dateStr, { totalAmount: 0, count: 0 });
      }
      const dailyData = dailySalesMap.get(dateStr)!;
      dailyData.totalAmount += amount;
      dailyData.count += 1;

      // Monthly sales
      if (!monthlySalesMap.has(monthStr)) {
        monthlySalesMap.set(monthStr, { totalAmount: 0, count: 0 });
      }
      const monthlyData = monthlySalesMap.get(monthStr)!;
      monthlyData.totalAmount += amount;
      monthlyData.count += 1;

      // Room type sales
      if (!roomTypeSalesMap.has(roomType)) {
        roomTypeSalesMap.set(roomType, { totalAmount: 0, count: 0 });
      }
      const roomTypeData = roomTypeSalesMap.get(roomType)!;
      roomTypeData.totalAmount += amount;
      roomTypeData.count += 1;

      // 详细日销售数据
      if (!detailedDailySalesMap.has(dateStr)) {
        detailedDailySalesMap.set(dateStr, {
          totalAmount: 0,
          privateSaunaAmount: 0,
          totalCount: 0,
          saunaTotalCount: 0, // 只计算sauna房间的总件数
          dayUseAmount: 0,
          dayUseCount: 0,
          dayUseOnly: 0,
          roomTypeCounts: {
            tototo: 0,
            fuuu: 0,
            zabuun: 0,
            toron: 0,
            sauna_suite: 0,
          }
        });
      }
      
      const detailedData = detailedDailySalesMap.get(dateStr)!;
      detailedData.totalAmount += amount;
      detailedData.totalCount += 1;

      // 分类处理不同房间类型
      if (['tototo', 'fuuu', 'zabuun', 'toron', 'sauna_suite'].includes(roomType)) {
        // 桑拿房间
        detailedData.privateSaunaAmount += amount;
        detailedData.saunaTotalCount += 1; // 增加sauna房间的总件数
        
        if (roomType !== 'sauna_suite') {
          detailedData.roomTypeCounts[roomType as keyof typeof detailedData.roomTypeCounts] += 1;
        } else {
          detailedData.roomTypeCounts.sauna_suite += 1;
        }
        
        // 检查是否是set plan（包含slow_room）
        // 这里需要根据实际的数据结构判断是否是set plan
        // 暂时假设reservation中有slowRoomAsSetPlan字段来标识
        // if (reservation.slowRoomAsSetPlan) {
        //   detailedData.dayUseAmount += (amount * 0.3); // 假设slow_room占set plan的30%
        //   detailedData.dayUseCount += 1;
        // }
      } else if (roomType === 'slow_room') {
        // 单独的slow_room预约
        detailedData.dayUseAmount += amount;
        detailedData.dayUseCount += 1;
        detailedData.dayUseOnly += 1;
      }
    });

    const dailySales = Array.from(dailySalesMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const monthlySales = Array.from(monthlySalesMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const roomTypeSales = Array.from(roomTypeSalesMap.entries())
      .map(([roomType, data]) => ({ roomType, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // 详细日销售数据用于Excel导出
    const detailedDailySales = Array.from(detailedDailySalesMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // リピーター统计数据处理
    // 1. 获取所有已付款的预约记录用于リピーター分析（不限日期范围）
    const allReservationsSnapshot = await db.collection('reservations')
      .where('paymentStatus', '==', 'paid')
      .get();
    
    const allReservations = allReservationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ReservationData[];

    // 按用户ID统计利用次数
    const userUsageMap = new Map<string, {
      userId: string;
      userName: string;
      userEmail: string;
      gender?: string;
      age?: number;
      firstVisitDate: Date;
      lastVisitDate: Date;
      totalVisits: number;
      totalAmount: number;
      roomTypes: string[];
    }>();

    allReservations.forEach((reservation) => {
      if (reservation.cancelledAt || !reservation.userId) return;

      const bookingDate = toDate(reservation.bookingDate);
      if (!bookingDate) return;

      const userId = reservation.userId;
      
      // 排除工作人员用户ID
      if (EXCLUDED_STAFF_USER_IDS.includes(userId)) return;
      const user = userMap.get(userId);
      const amount = typeof reservation.price === 'string' 
        ? parseFloat(reservation.price) || 0 
        : reservation.price || 0;

      if (!userUsageMap.has(userId)) {
        // 计算年龄
        let age: number | undefined;
        if (user?.birthdate) {
          const birthYear = new Date(user.birthdate).getFullYear();
          const currentYear = new Date().getFullYear();
          age = currentYear - birthYear;
        }

        userUsageMap.set(userId, {
          userId,
          userName: user?.fullName || reservation.userFullName || 'Unknown',
          userEmail: reservation.userEmail,
          gender: user?.gender,
          age,
          firstVisitDate: bookingDate,
          lastVisitDate: bookingDate,
          totalVisits: 1,
          totalAmount: amount,
          roomTypes: [reservation.roomType]
        });
      } else {
        const userData = userUsageMap.get(userId)!;
        userData.totalVisits += 1;
        userData.totalAmount += amount;
        userData.lastVisitDate = bookingDate > userData.lastVisitDate ? bookingDate : userData.lastVisitDate;
        userData.firstVisitDate = bookingDate < userData.firstVisitDate ? bookingDate : userData.firstVisitDate;
        if (!userData.roomTypes.includes(reservation.roomType)) {
          userData.roomTypes.push(reservation.roomType);
        }
      }
    });

    // リピーター统计分析
    const allUsers = Array.from(userUsageMap.values());
    const totalUsers = allUsers.length;
    const firstTimeUsers = allUsers.filter(user => user.totalVisits === 1).length;
    const repeatUsers = allUsers.filter(user => user.totalVisits >= 2).length;
    const repeaterRate = totalUsers > 0 ? (repeatUsers / totalUsers * 100) : 0;

    // 按性别统计
    const genderStats = {
      male: { total: 0, repeaters: 0 },
      female: { total: 0, repeaters: 0 },
      unknown: { total: 0, repeaters: 0 }
    };

    // 按年代统计
    const ageGroupStats = {
      '20代': { total: 0, repeaters: 0 },
      '30代': { total: 0, repeaters: 0 },
      '40代': { total: 0, repeaters: 0 },
      '50代': { total: 0, repeaters: 0 },
      '60代以上': { total: 0, repeaters: 0 },
      '不明': { total: 0, repeaters: 0 }
    };

    // 按利用次数分布统计
    const visitCountDistribution = {
      '1回': 0,
      '2回': 0,
      '3回': 0,
      '4回': 0,
      '5回以上': 0
    };

    allUsers.forEach(user => {
      const isRepeater = user.totalVisits >= 2;
      
      // 性别统计
      const genderKey = user.gender === 'male' ? 'male' : 
                       user.gender === 'female' ? 'female' : 'unknown';
      genderStats[genderKey].total += 1;
      if (isRepeater) genderStats[genderKey].repeaters += 1;

      // 年代统计
      let ageGroup = '不明';
      if (user.age && user.age >= 20) {
        if (user.age < 30) ageGroup = '20代';
        else if (user.age < 40) ageGroup = '30代';
        else if (user.age < 50) ageGroup = '40代';
        else if (user.age < 60) ageGroup = '50代';
        else ageGroup = '60代以上';
      }
      ageGroupStats[ageGroup as keyof typeof ageGroupStats].total += 1;
      if (isRepeater) ageGroupStats[ageGroup as keyof typeof ageGroupStats].repeaters += 1;

      // 利用次数分布
      if (user.totalVisits === 1) visitCountDistribution['1回'] += 1;
      else if (user.totalVisits === 2) visitCountDistribution['2回'] += 1;
      else if (user.totalVisits === 3) visitCountDistribution['3回'] += 1;
      else if (user.totalVisits === 4) visitCountDistribution['4回'] += 1;
      else visitCountDistribution['5回以上'] += 1;
    });

    const repeaterStats = {
      overview: {
        totalUsers,
        firstTimeUsers,
        repeatUsers,
        repeaterRate: Math.round(repeaterRate * 100) / 100
      },
      genderStats,
      ageGroupStats,
      visitCountDistribution,
      userDetails: allUsers
        .sort((a, b) => b.totalVisits - a.totalVisits)
        .map(user => {
          // 使用本地时间格式化日期，避免时区问题
          const formatLocalDate = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}/${month}/${day}`;
          };
          
          return {
            ...user,
            firstVisitDate: formatLocalDate(user.firstVisitDate),
            lastVisitDate: formatLocalDate(user.lastVisitDate),
            roomTypes: user.roomTypes.join(', ')
          };
        })
    };

    return NextResponse.json({
      dailySales,
      monthlySales,
      roomTypeSales,
      detailedDailySales,
      repeaterStats
    });
  } catch (error) {
    console.error('Error fetching sales statistics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';