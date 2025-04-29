import { FirestoreTimestamp } from './reservation';

// 优惠券类型
export enum CouponDiscountType {
  FIXED = 'fixed',     // 固定金额折扣
  PERCENTAGE = 'percentage' // 百分比折扣
}

// 优惠券主表
export interface Coupon {
  id: string;                    // 优惠券 ID
  code: string;                  // 优惠券码（用户输入使用）
  name: string;                  // 优惠券名称
  description: string;           // 优惠券描述
  discountType: CouponDiscountType; // 折扣类型
  discountValue: number;         // 折扣值（固定金额或百分比）
  minAmount: number;             // 最低消费金额
  maxDiscount?: number;          // 最大折扣金额（百分比折扣时使用）
  validFrom: FirestoreTimestamp; // 有效期开始
  validTo: FirestoreTimestamp;   // 有效期结束
  usageLimit: number;            // 总使用次数限制（-1表示不限）
  perUserLimit: number;          // 每用户使用次数限制（-1表示不限）
  usedCount: number;             // 已使用次数
  isActive: boolean;             // 是否激活
  applicableRoomTypes: string[]; // 适用房型列表
  applicableDaysOfWeek: number[]; // 适用星期（0-6，0表示周日）
  isFirstTimeOnly: boolean;      // 是否仅限首次预约使用
  createdAt: FirestoreTimestamp; // 创建时间
  updatedAt: FirestoreTimestamp; // 更新时间
}

// 优惠券使用记录表
export interface CouponUsage {
  id: string;               // 使用记录 ID
  couponId: string;         // 优惠券 ID
  userId: string;           // 用户 ID
  reservationId: string;    // 预约 ID
  discountAmount: number;   // 实际折扣金额
  usedAt: FirestoreTimestamp; // 使用时间
  originalAmount: number;   // 原始金额
  finalAmount: number;      // 折扣后金额
}
