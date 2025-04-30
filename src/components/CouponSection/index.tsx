import { useState } from "react";
import { auth } from "@/utils/firebase";
import { Coupon, CouponDiscountType } from "@/types/coupon";

// 定义组件接口
interface CouponSectionProps {
  onCouponApplied: (coupon: Coupon) => void;
  onCouponRemoved: () => void;
}

// 优惠券组件
const CouponSection = ({ onCouponApplied, onCouponRemoved }: CouponSectionProps) => {
  const [couponCode, setCouponCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  
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
      const response = await fetch(`/api/validate-coupon?code=${encodeURIComponent(couponCode)}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setCouponError(data.error || "クーポンの検証に失敗しました");
        setAppliedCoupon(null);
        return;
      }
      
      // 设置已应用的优惠券
      const coupon: Coupon = data.coupon;
      setAppliedCoupon(coupon);
      
      // 通知父组件更新价格
      onCouponApplied(coupon);
      
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
    onCouponRemoved();
  };
  
  return (
    <div className="space-y-4 bg-gray-50 py-4 px-0 rounded-md">
      <h3 className="font-bold text-gray-700 font-zen-kaku-gothic mb-2">クーポン</h3>
      
      {appliedCoupon ? (
        <div className="flex items-center justify-between bg-white p-3 rounded">
          <div className="space-y-1.5">
            <p className="font-medium text-sm text-gray-800 font-zen-kaku-gothic">{appliedCoupon.name}</p>
            <p className="text-xs text-gray-600 font-zen-kaku-gothic">{appliedCoupon.description}</p>
            <p className="text-sm font-bold text-red-600 font-zen-kaku-gothic">
              {appliedCoupon.discountType === CouponDiscountType.FIXED 
                ? `${appliedCoupon.discountValue.toLocaleString()}円割引` 
                : `${appliedCoupon.discountValue}%割引`}
            </p>
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
                className="w-full sm:w-[250px] border border-gray-300 rounded-l-md px-3 py-2 text-sm font-zen-kaku-gothic appearance-none focus:outline-none focus:ring-0 focus:border-gray-300"
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