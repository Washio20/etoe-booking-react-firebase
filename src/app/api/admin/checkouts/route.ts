import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/utils/firebase-admin';
import { CheckoutStatus, CheckoutRecord } from '@/types/checkout';

// 确保Firebase Admin已初始化
initAdmin();

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

    const db = getFirestore();
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');

    let startTimestamp: Timestamp;
    let endTimestamp: Timestamp;

    if (date) {
      // 指定日期
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      startTimestamp = Timestamp.fromDate(targetDate);
      
      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);
      endTimestamp = Timestamp.fromDate(endDate);
    } else {
      // 默认今天
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startTimestamp = Timestamp.fromDate(today);
      
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      endTimestamp = Timestamp.fromDate(endOfDay);
    }

    // 获取指定日期的退房记录
    const checkoutsSnapshot = await db.collection('checkouts')
      .where('checkedOutAt', '>=', startTimestamp)
      .where('checkedOutAt', '<=', endTimestamp)
      .orderBy('checkedOutAt', 'desc')
      .get();

    const checkouts = checkoutsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CheckoutRecord[];

    // 统计信息
    const totalCheckouts = checkouts.length; // 总退房次数
    const checkedOutRooms = checkouts.filter(c => c.status === CheckoutStatus.CHECKED_OUT).length;
    const readyRooms = checkouts.filter(c => c.status === CheckoutStatus.READY).length;
    
    // 计算涉及的房间数（去重）
    const uniqueRoomIds = Array.from(new Set(checkouts.map(c => c.roomId)));
    const uniqueRoomsCount = uniqueRoomIds.length;

    return NextResponse.json({
      checkouts,
      summary: {
        totalRooms: totalCheckouts, // 保持字段名兼容，但实际是退房次数
        totalCheckouts, // 新增：明确的退房次数
        uniqueRoomsCount, // 新增：涉及的房间数
        checkedOutRooms,
        readyRooms,
        date: date || new Date().toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Error fetching checkout records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // 验证Firebase ID令牌和管理员权限
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: '認証トークンが無効です' }, { status: 401 });
    }
    
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};
    
    if (!customClaims.admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { checkoutId, status, staffNote } = body;

    if (!checkoutId || !status) {
      return NextResponse.json({ error: 'checkoutId と status は必須です' }, { status: 400 });
    }

    if (!Object.values(CheckoutStatus).includes(status)) {
      return NextResponse.json({ error: '無効なstatusです' }, { status: 400 });
    }

    const db = getFirestore();
    const checkoutRef = db.collection('checkouts').doc(checkoutId);
    
    // 更新记录
    await checkoutRef.update({
      status,
      staffNote: staffNote || null,
      updatedAt: Timestamp.now()
    });

    return NextResponse.json({
      success: true,
      message: 'ステータスが更新されました'
    });

  } catch (error) {
    console.error('Error updating checkout status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';