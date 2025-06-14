import { useState } from "react";
import { auth } from "@/utils/firebase";
import { Coupon, CouponDiscountType } from "@/types/coupon";

// 定义组件接口
interface CouponSectionProps {
  onCouponApplied: (coupon: Coupon, discountBreakdown?: DiscountBreakdown) => void;
  onCouponRemoved: () => void;
  // 添加预约类型和价格信息
  reservationData?: {
    roomType: string;
    roomPrice: number;
    slowRoomPrice?: number;
    hasSlowRoomPlan?: boolean;
  };
}

// 折扣详情接口
interface DiscountBreakdown {
  totalDiscount: number;
  roomDiscount: number;
  slowRoomDiscount: number;
  applicableItems: string[];
}

// 优惠券组件
const CouponSection = ({ 
  onCouponApplied, 
  onCouponRemoved, 
  reservationData 
}: CouponSectionProps) => {
  const [couponCode, setCouponCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountBreakdown, setDiscountBreakdown] = useState<DiscountBreakdown | null>(null);
  
  // 计算优惠券折扣详情
  const calculateCouponDiscount = (coupon: Coupon): DiscountBreakdown => {
    if (!reservationData) {
      return {
        totalDiscount: 0,
        roomDiscount: 0,
        slowRoomDiscount: 0,
        applicableItems: []
      };
    }

    const { roomType, roomPrice, slowRoomPrice = 0, hasSlowRoomPlan = false } = reservationData;
    
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
        if (coupon.discountType === CouponDiscountType.FIXED) {
          roomDiscount = Math.min(coupon.discountValue, roomPrice);
        } else {
          roomDiscount = Math.floor(roomPrice * (coupon.discountValue / 100));
          if (coupon.maxDiscount && coupon.maxDiscount > 0) {
            roomDiscount = Math.min(roomDiscount, coupon.maxDiscount);
          }
        }
        applicableItems.push('スロールーム');
      }
    }
    // sauna+スロールーム套餐预约
    else if (hasSlowRoomPlan && slowRoomPrice > 0) {
      // 检查是否适用于主房间
      if (isApplicableToRoom) {
        if (coupon.discountType === CouponDiscountType.FIXED) {
          roomDiscount = Math.min(coupon.discountValue, roomPrice);
        } else {
          roomDiscount = Math.floor(roomPrice * (coupon.discountValue / 100));
          if (coupon.maxDiscount && coupon.maxDiscount > 0) {
            roomDiscount = Math.min(roomDiscount, coupon.maxDiscount);
          }
        }
        applicableItems.push(getRoomTypeDisplayName(roomType));
      }

      // 检查是否适用于slow room
      if (isApplicableToSlowRoom) {
        if (coupon.discountType === CouponDiscountType.FIXED) {
          // 对于固定金额折扣，如果已经对主房间应用了折扣，则不再对slow room应用
          if (roomDiscount === 0) {
            slowRoomDiscount = Math.min(coupon.discountValue, slowRoomPrice + 1000); // +1000是因为套餐折扣
          }
        } else {
          // 对于百分比折扣，只对slow room的原价部分应用折扣
          const slowRoomOriginalPrice = slowRoomPrice + 1000; // 恢复套餐折扣前的价格
          slowRoomDiscount = Math.floor(slowRoomOriginalPrice * (coupon.discountValue / 100));
          if (coupon.maxDiscount && coupon.maxDiscount > 0) {
            slowRoomDiscount = Math.min(slowRoomDiscount, coupon.maxDiscount);
          }
        }
        if (slowRoomDiscount > 0) {
          applicableItems.push('スロールーム');
        }
      }
    }
    // 单独sauna预约或サウナスイート预约
    else {
      if (isApplicableToRoom) {
        if (coupon.discountType === CouponDiscountType.FIXED) {
          roomDiscount = Math.min(coupon.discountValue, roomPrice);
        } else {
          roomDiscount = Math.floor(roomPrice * (coupon.discountValue / 100));
          if (coupon.maxDiscount && coupon.maxDiscount > 0) {
            roomDiscount = Math.min(roomDiscount, coupon.maxDiscount);
          }
        }
        applicableItems.push(getRoomTypeDisplayName(roomType));
      }
    }

    const totalDiscount = roomDiscount + slowRoomDiscount;

    return {
      totalDiscount,
      roomDiscount,
      slowRoomDiscount,
      applicableItems
    };
  };

  // 获取房间类型显示名称
  const getRoomTypeDisplayName = (roomType: string): string => {
    switch (roomType) {
      case 'tototo': return 'TOTOTO';
      case 'fuuu': return 'FUUU';
      case 'zabuun': return 'ZABUUN';
      case 'toron': return 'TORON';
      case 'sauna_suite': return 'サウナスイート';
      case 'slow_room': return 'スロールーム';
      default: return roomType;
    }
  };
  
  // 验证优惠券
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("クーポンコードを入力してください");
      return;
    }
    
    try {
      setIsApplying(true);
      setCouponError(null);
      
      // 获取当前用户的ID令牌
      const user = auth.currentUser;
      if (!user) {
        setCouponError("ログインが必要です");
        return;
      }
      
      const idToken = await user.getIdToken();
      
      // 构建请求URL，包含预约信息
      const params = new URLSearchParams({
        code: couponCode
      });
      
      if (reservationData) {
        params.append('roomType', reservationData.roomType);
        params.append('roomPrice', reservationData.roomPrice.toString());
        if (reservationData.slowRoomPrice) {
          params.append('slowRoomPrice', reservationData.slowRoomPrice.toString());
        }
        if (reservationData.hasSlowRoomPlan) {
          params.append('hasSlowRoomPlan', 'true');
        }
      }
      
      const response = await fetch(`/api/validate-coupon?${params}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setCouponError(data.error || "クーポンの検証に失敗しました");
        setAppliedCoupon(null);
        setDiscountBreakdown(null);
        return;
      }
      
      // 设置已应用的优惠券
      const coupon: Coupon = data.coupon;
      setAppliedCoupon(coupon);
      
      // 计算折扣详情
      const breakdown = calculateCouponDiscount(coupon);
      setDiscountBreakdown(breakdown);
      
      // 检查是否有可应用的项目
      if (breakdown.applicableItems.length === 0) {
        setCouponError("このクーポンは現在の予約には適用できません");
        setAppliedCoupon(null);
        setDiscountBreakdown(null);
        return;
      }
      
      // 通知父组件更新价格
      onCouponApplied(coupon, breakdown);
      
      // 清除输入框
      setCouponCode("");
    } catch (error) {
      console.error("クーポン検証エラー:", error);
      setCouponError("クーポンの検証中にエラーが発生しました");
    } finally {
      setIsApplying(false);
    }
  };
  
  // 移除优惠券
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountBreakdown(null);
    onCouponRemoved();
  };
  
  return (
    <div className="space-y-4 bg-gray-50 py-4 px-0 rounded-md">
      <h3 className="font-bold text-gray-700 font-zen-kaku-gothic mb-2">クーポン</h3>
      
      {appliedCoupon ? (
        <div className="flex items-center justify-between bg-white p-3 rounded">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm text-gray-800 font-zen-kaku-gothic">{appliedCoupon.name}</p>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 font-zen-kaku-gothic">
                {appliedCoupon.discountType === CouponDiscountType.FIXED 
                  ? `${appliedCoupon.discountValue.toLocaleString()}円割引` 
                  : `${appliedCoupon.discountValue}%割引`}
              </span>
            </div>
            <p className="text-xs text-gray-600 font-zen-kaku-gothic">{appliedCoupon.description}</p>
            
            {/* 显示折扣详情 */}
            {discountBreakdown && (
              <div className="text-sm font-zen-kaku-gothic">
                <p className="font-bold text-red-600">
                  合計割引: {discountBreakdown.totalDiscount.toLocaleString()}円
                </p>
                <div className="text-sm text-gray-700 mt-1">
                  <p>適用対象: {discountBreakdown.applicableItems.join('、')}</p>
                  {discountBreakdown.roomDiscount > 0 && (
                    <p>• {getRoomTypeDisplayName(reservationData?.roomType || '')}: -{discountBreakdown.roomDiscount.toLocaleString()}円</p>
                  )}
                  {discountBreakdown.slowRoomDiscount > 0 && (
                    <p>• スロールーム: -{discountBreakdown.slowRoomDiscount.toLocaleString()}円</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={handleRemoveCoupon}
            className="text-sm text-red-600 hover:text-red-800 font-zen-kaku-gothic"
          >
            削除
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm sm:text-sm md:text-base text-gray-700 font-zen-kaku-gothic">お持ちのクーポンコードを入力してください</p>
          <div className="flex items-center">
            <div className="flex w-full sm:w-auto">
              <input
                type="text"
                placeholder="クーポンコード"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="w-full sm:w-[250px] border border-gray-300 rounded-l-md px-3 py-2 text-sm font-zen-kaku-gothic appearance-none focus:outline-none focus:ring-0 focus:border-gray-300 text-black"
                style={{ fontSize: '16px', WebkitAppearance: 'none' }}
              />
              <button
                onClick={handleValidateCoupon}
                disabled={isApplying || !couponCode.trim()}
                className={`whitespace-nowrap px-4 py-2 rounded-r-md text-white text-sm font-zen-kaku-gothic ${
                  isApplying || !couponCode.trim() ? "bg-gray-400" : "bg-gray-700 hover:bg-gray-800"
                }`}
              >
                {isApplying ? "確認中..." : "適用"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {couponError && (
        <p className="text-sm sm:text-sm md:text-base font-medium text-red-600 font-zen-kaku-gothic">{couponError}</p>
      )}
    </div>
  );
};

export default CouponSection;