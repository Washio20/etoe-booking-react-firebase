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
      
      // 排除工作人员用户ID
      if (reservation.userId && EXCLUDED_STAFF_USER_IDS.includes(reservation.userId)) return;

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

    // リピーター统计数据处理（期间範囲対応）
    // 1. 期间内的预约数据（已经过滤）
    const periodReservations = reservations;
    
    // 2. 收集期间内所有用户ID，然后查询他们的完整历史
    const periodUserIds = new Set<string>();
    periodReservations.forEach((reservation: ReservationData) => {
      if (reservation.userId && 
          !reservation.cancelledAt && 
          !EXCLUDED_STAFF_USER_IDS.includes(reservation.userId)) {
        periodUserIds.add(reservation.userId);
      }
    });

    // console.log(`期間内利用ユーザー数: ${periodUserIds.size}`);

    // 按用户ID统计利用次数（期间範囲対応）
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
      // 新增期间内统计字段
      periodVisits?: number;        // 期间内利用次数
      periodTotalAmount?: number;   // 期间内总金额
      isNewUser?: boolean;          // 是否为期间内新用户
      isRepeater?: boolean;         // 是否为既存用户（期间前有利用记录）
      isPeriodRepeater?: boolean;   // 是否为期间内複数回利用者
    }>();

    // 查询期间内所有用户的完整历史数据
    const periodUserIdsArray = Array.from(periodUserIds);
    const userHistoryMap = new Map<string, ReservationData[]>();
    
    // 分批查询用户历史数据（避免Firestore in查询限制）
    const batchSize = 10;
    const historyBatches = [];
    for (let i = 0; i < periodUserIdsArray.length; i += batchSize) {
      const batch = periodUserIdsArray.slice(i, i + batchSize);
      if (batch.length > 0) {
        historyBatches.push(
          db.collection('reservations')
            .where('paymentStatus', '==', 'paid')
            .where('userId', 'in', batch)
            .get()
        );
      }
    }

    // 执行所有批次查询
    const allHistoryBatchResults = await Promise.all(historyBatches);
    const allUserHistory: ReservationData[] = [];
    
    allHistoryBatchResults.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        allUserHistory.push({
          id: doc.id,
          ...doc.data()
        } as ReservationData);
      });
    });

    // 按用户组织历史数据
    allUserHistory.forEach(reservation => {
      if (reservation.userId && !reservation.cancelledAt) {
        if (!userHistoryMap.has(reservation.userId)) {
          userHistoryMap.set(reservation.userId, []);
        }
        userHistoryMap.get(reservation.userId)!.push(reservation);
      }
    });

    // 分析每个用户的类型：基于历史利用记录判断
    const userTypeMap = new Map<string, { isNewUser: boolean; isRepeater: boolean }>();
    
    periodUserIds.forEach(userId => {
      const userHistory = userHistoryMap.get(userId) || [];
      
      // 按时间排序所有历史记录
      const sortedHistory = userHistory
        .map(reservation => ({
          ...reservation,
          bookingDateObj: toDate(reservation.bookingDate)
        }))
        .filter(reservation => reservation.bookingDateObj)
        .sort((a, b) => a.bookingDateObj!.getTime() - b.bookingDateObj!.getTime());

      if (sortedHistory.length === 0) {
        // 没有历史数据，标记为新用户
        userTypeMap.set(userId, { isNewUser: true, isRepeater: false });
        return;
      }

      const periodStartDate = toDate(startTimestamp);
      const periodEndDate = toDate(endTimestamp);
      
      if (!periodStartDate || !periodEndDate) {
        userTypeMap.set(userId, { isNewUser: true, isRepeater: false });
        return;
      }

      // 统计期间前和期间内的利用次数
      let beforePeriodCount = 0;
      let inPeriodCount = 0;
      
      sortedHistory.forEach(reservation => {
        const visitDate = reservation.bookingDateObj!;
        if (visitDate < periodStartDate) {
          beforePeriodCount++;
        } else if (visitDate >= periodStartDate && visitDate <= periodEndDate) {
          inPeriodCount++;
        }
      });

      // 新的判断逻辑：
      // 既存用户 = 期间前有利用记录 OR 总利用次数 >= 2
      // 新规用户 = 期间前没有记录 AND 总利用次数 = 1
      const totalVisits = sortedHistory.length;
      const hasPrePeriodVisits = beforePeriodCount > 0;
      const isRepeater = hasPrePeriodVisits || totalVisits >= 2;
      
      userTypeMap.set(userId, {
        isNewUser: !isRepeater,
        isRepeater: isRepeater
      });
    });

    const newUsersCount = Array.from(userTypeMap.values()).filter(u => u.isNewUser).length;
    const existingUsersCount = Array.from(userTypeMap.values()).filter(u => u.isRepeater).length;
    
    // console.log(`=== 用户类型分析结果 ===`);
    // console.log(`期間内利用ユーザー数: ${periodUserIds.size}`);
    // console.log(`新規ユーザー数: ${newUsersCount} (期間前无记录且总利用次数=1)`);
    // console.log(`既存ユーザー数: ${existingUsersCount} (期間前有记录 OR 总利用次数>=2)`);

    // 处理期间内的预约数据
    periodReservations.forEach((reservation: ReservationData) => {
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

      // 获取用户类型
      const userType = userTypeMap.get(userId);
      if (!userType) return;

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
          totalVisits: 0,  // 初始化为0，后面会从历史数据更新
          totalAmount: 0,  // 初始化为0，后面会从历史数据更新
          roomTypes: [reservation.roomType],
          // 新增字段 - 使用确定的用户类型
          periodVisits: 1,
          periodTotalAmount: amount,
          isNewUser: userType.isNewUser,
          isRepeater: userType.isRepeater,
          isPeriodRepeater: false
        });
      } else {
        const userData = userUsageMap.get(userId)!;
        // 不要累加totalVisits和totalAmount，这些会从历史数据计算
        // userData.totalVisits += 1;  // 删除这行
        // userData.totalAmount += amount;  // 删除这行
        userData.periodVisits = (userData.periodVisits || 0) + 1;
        userData.periodTotalAmount = (userData.periodTotalAmount || 0) + amount;
        userData.isPeriodRepeater = (userData.periodVisits || 0) >= 2;
        userData.lastVisitDate = bookingDate > userData.lastVisitDate ? bookingDate : userData.lastVisitDate;
        userData.firstVisitDate = bookingDate < userData.firstVisitDate ? bookingDate : userData.firstVisitDate;
        if (!userData.roomTypes.includes(reservation.roomType)) {
          userData.roomTypes.push(reservation.roomType);
        }
      }
    });

    // 使用已经获取的历史数据更新totalVisits和totalAmount
    const userTotalStats = new Map<string, { visits: number; amount: number; firstDate: Date; lastDate: Date }>();
    
    allUserHistory.forEach((reservation: ReservationData) => {
      if (reservation.cancelledAt || 
          !reservation.userId ||
          EXCLUDED_STAFF_USER_IDS.includes(reservation.userId)) {
        return;
      }

      const userId = reservation.userId;
      const bookingDate = toDate(reservation.bookingDate);
      if (!bookingDate) return;
      
      const amount = typeof reservation.price === 'string' 
        ? parseFloat(reservation.price) || 0 
        : reservation.price || 0;

      if (userTotalStats.has(userId)) {
        const stats = userTotalStats.get(userId)!;
        stats.visits += 1;
        stats.amount += amount;
        if (bookingDate < stats.firstDate) stats.firstDate = bookingDate;
        if (bookingDate > stats.lastDate) stats.lastDate = bookingDate;
      } else {
        userTotalStats.set(userId, {
          visits: 1,
          amount: amount,
          firstDate: bookingDate,
          lastDate: bookingDate
        });
      }
    });

    // 更新userUsageMap中的总数据
    userUsageMap.forEach((userData, userId) => {
      const totalStats = userTotalStats.get(userId);
      if (totalStats) {
        userData.totalVisits = totalStats.visits;
        userData.totalAmount = totalStats.amount;
        userData.firstVisitDate = totalStats.firstDate;
        userData.lastVisitDate = totalStats.lastDate;
      }
    });

    // リピーター统计分析（期間範囲対応）
    const allUsers = Array.from(userUsageMap.values());
    const totalUsers = allUsers.length; // 期间内利用者数
    
    // 期间内新用户（期间前没有利用记录）
    const newUsers = allUsers.filter(user => user.isNewUser === true).length;
    
    // 期间内既存用户（期间前有利用记录）
    const existingUsers = allUsers.filter(user => user.isRepeater === true).length;
    
    // 期间内複数回利用者（期间内利用了2次以上）
    const periodRepeaters = allUsers.filter(user => user.isPeriodRepeater === true).length;
    
    // 计算比率
    const newUserRate = totalUsers > 0 ? (newUsers / totalUsers * 100) : 0;
    const existingUserRate = totalUsers > 0 ? (existingUsers / totalUsers * 100) : 0;

    // 按性别统计（期間範囲対応）
    const genderStats = {
      male: { total: 0, newUsers: 0, existingUsers: 0 },
      female: { total: 0, newUsers: 0, existingUsers: 0 },
      unknown: { total: 0, newUsers: 0, existingUsers: 0 }
    };

    // 按年代统计（期間範囲対応）
    const ageGroupStats = {
      '20代': { total: 0, newUsers: 0, existingUsers: 0 },
      '30代': { total: 0, newUsers: 0, existingUsers: 0 },
      '40代': { total: 0, newUsers: 0, existingUsers: 0 },
      '50代': { total: 0, newUsers: 0, existingUsers: 0 },
      '60代以上': { total: 0, newUsers: 0, existingUsers: 0 },
      '不明': { total: 0, newUsers: 0, existingUsers: 0 }
    };

    // 按期间内利用次数分布统计
    const periodVisitCountDistribution = {
      '1回': 0,
      '2回': 0,
      '3回': 0,
      '4回': 0,
      '5回以上': 0
    };

    allUsers.forEach(user => {
      const isNewUser = user.isNewUser === true;
      const isExistingUser = user.isRepeater === true;
      
      // 性别统计
      const genderKey = user.gender === 'male' ? 'male' : 
                       user.gender === 'female' ? 'female' : 'unknown';
      genderStats[genderKey].total += 1;
      if (isNewUser) genderStats[genderKey].newUsers += 1;
      if (isExistingUser) genderStats[genderKey].existingUsers += 1;

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
      if (isNewUser) ageGroupStats[ageGroup as keyof typeof ageGroupStats].newUsers += 1;
      if (isExistingUser) ageGroupStats[ageGroup as keyof typeof ageGroupStats].existingUsers += 1;

      // 期间内利用次数分布
      const periodVisits = user.periodVisits || 0;
      if (periodVisits === 1) periodVisitCountDistribution['1回'] += 1;
      else if (periodVisits === 2) periodVisitCountDistribution['2回'] += 1;
      else if (periodVisits === 3) periodVisitCountDistribution['3回'] += 1;
      else if (periodVisits === 4) periodVisitCountDistribution['4回'] += 1;
      else if (periodVisits >= 5) periodVisitCountDistribution['5回以上'] += 1;
    });

    // 详细调试信息
    // console.log('=== 詳細デバッグ情報 ===');
    // console.log('期間内利用回数分布:', periodVisitCountDistribution);
    
    // 找出期间内利用次数>=2的用户
    const multipleVisitUsers = allUsers.filter(u => (u.periodVisits || 0) >= 2);
    // console.log(`期間内複数回利用ユーザー詳細 (${multipleVisitUsers.length}名):`);
    // multipleVisitUsers.forEach(u => {
    //   console.log(`- ${u.userName}: 期間内=${u.periodVisits}回, 総利用=${u.totalVisits}回`);
    // });
    
    // 全用户的期间内利用次数统计
    const periodVisitsCount = allUsers.reduce((acc, u) => {
      const visits = u.periodVisits || 0;
      acc[visits] = (acc[visits] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    // console.log('実際の期間内利用回数統計:', periodVisitsCount);

    const repeaterStats = {
      overview: {
        totalUsers,                // 期間内総利用者数
        newUsers,                  // 期間内新規ユーザー数
        existingUsers,             // 期間内既存ユーザー数（期間前に利用歴あり）
        periodRepeaters,           // 期間内複数回利用者数
        newUserRate: Math.round(newUserRate * 100) / 100,
        existingUserRate: Math.round(existingUserRate * 100) / 100
      },
      genderStats,
      ageGroupStats,
      visitCountDistribution: periodVisitCountDistribution,
      userDetails: allUsers.map(user => ({
        ...user,
        periodVisits: user.periodVisits || 0,
        periodTotalAmount: user.periodTotalAmount || 0,
        isNewUser: user.isNewUser || false,
        isRepeater: user.isRepeater || false,
        isPeriodRepeater: user.isPeriodRepeater || false
      }))
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