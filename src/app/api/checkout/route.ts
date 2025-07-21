import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/utils/firebase-admin';
import { CheckoutStatus } from '@/types/checkout';

// 确保Firebase Admin已初始化
initAdmin();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, guestNote } = body;

    // 验证房间号
    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json({ error: '房间号は必須です' }, { status: 400 });
    }

    // 验证房间号格式（数字格式，如：101, 102, 201等）
    if (!/^\d{3}$/.test(roomId)) {
      return NextResponse.json({ error: '無効な部屋番号です' }, { status: 400 });
    }

    const db = getFirestore();
    const now = Timestamp.now();

    // 注：同日多次退房是允许的（比如sauna房间按小时使用）
    // 不再检查是否已经退房，直接创建新的退房记录

    // 创建退房记录
    const checkoutData = {
      roomId,
      checkedOutAt: now,
      status: CheckoutStatus.CHECKED_OUT,
      createdAt: now,
      updatedAt: now,
      guestNote: guestNote || null
    };

    const docRef = await db.collection('checkouts').add(checkoutData);

    return NextResponse.json({
      success: true,
      message: `${roomId}号室の退房手続きが完了しました`,
      checkoutId: docRef.id,
      roomId,
      checkedOutAt: now.toDate().toISOString()
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ 
      error: 'システムエラーが発生しました',
      message: '退房手続き中にエラーが発生しました。しばらく時間をおいてから再度お試しください。'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';