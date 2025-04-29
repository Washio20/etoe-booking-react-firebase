"use client";

import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import { auth } from "@/utils/firebase";
import { Coupon, CouponDiscountType } from "@/types/coupon";
import { convertToDate } from "@/utils/date";

// 表单数据类型
interface CouponFormData {
  code: string;
  name: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minAmount: number;
  maxDiscount: number;
  validFrom: string;
  validTo: string;
  usageLimit: number;
  perUserLimit: number;
  isActive: boolean;
  applicableRoomTypes: string[];
  isFirstTimeOnly: boolean;
}

export default function EditCoupon({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  const [adminState, setAdminState] = useState({
    isAdmin: false,
    checkComplete: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState<CouponFormData>({
    code: "",
    name: "",
    description: "",
    discountType: CouponDiscountType.FIXED,
    discountValue: 1000,
    minAmount: 0,
    maxDiscount: 0,
    validFrom: "",
    validTo: "",
    usageLimit: -1,
    perUserLimit: -1,
    isActive: true,
    applicableRoomTypes: [],
    isFirstTimeOnly: false,
  });
  
  // 检查管理员权限
  useEffect(() => {
    if (loading) return;

    const checkAdminStatus = async () => {
      if (!user) {
        setAdminState({ isAdmin: false, checkComplete: true });
        return;
      }

      try {
        const idTokenResult = await user.getIdTokenResult(true);
        const isUserAdmin = idTokenResult.claims.admin === true;
        setAdminState({ isAdmin: isUserAdmin, checkComplete: true });
      } catch (error) {
        console.error("管理者権限チェックエラー:", error);
        setAdminState({ isAdmin: false, checkComplete: true });
      }
    };

    checkAdminStatus();
  }, [user, loading]);
  
  // 加载优惠券数据
  useEffect(() => {
    if (!user || !adminState.isAdmin || !params.id) return;
    
    const loadCoupon = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/admin/coupons/${params.id}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        
        if (response.ok) {
          const couponData = await response.json();
          // 格式化日期时间字符串用于表单
          const formatDateTimeForInput = (timestamp: any) => {
            if (!timestamp) return "";
            
            try {
              const date = convertToDate(timestamp);
              if (!date) return "";
              
              // 调整为日本时区 (UTC+9)，因为HTML datetime-local输入控件需要本地时间
              const japanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
              
              // 格式化为YYYY-MM-DDTHH:MM格式
              const year = japanTime.getUTCFullYear();
              const month = String(japanTime.getUTCMonth() + 1).padStart(2, '0');
              const day = String(japanTime.getUTCDate()).padStart(2, '0');
              const hours = String(japanTime.getUTCHours()).padStart(2, '0');
              const minutes = String(japanTime.getUTCMinutes()).padStart(2, '0');
              
              return `${year}-${month}-${day}T${hours}:${minutes}`;
            } catch (error) {
              console.error("日期格式化错误:", error);
              return "";
            }
          };
          
          // 将API数据转换为表单数据
          setFormData({
            code: couponData.coupon?.code || "",
            name: couponData.coupon?.name || "",
            description: couponData.coupon?.description || "",
            discountType: couponData.coupon?.discountType || CouponDiscountType.FIXED,
            discountValue: couponData.coupon?.discountValue || 0,
            minAmount: couponData.coupon?.minAmount || 0,
            maxDiscount: couponData.coupon?.maxDiscount || 0,
            validFrom: formatDateTimeForInput(couponData.coupon?.validFrom),
            validTo: formatDateTimeForInput(couponData.coupon?.validTo),
            usageLimit: couponData.coupon?.usageLimit ?? -1,
            perUserLimit: couponData.coupon?.perUserLimit ?? -1,
            isActive: couponData.coupon?.isActive !== false, // 默认为true
            applicableRoomTypes: couponData.coupon?.applicableRoomTypes || [],
            isFirstTimeOnly: couponData.coupon?.isFirstTimeOnly || false,
          });
        } else {
          const errorData = await response.json();
          setErrorMessage(errorData.error || "クーポン情報の取得に失敗しました");
        }
      } catch (error) {
        console.error("Error loading coupon:", error);
        setErrorMessage("クーポン情報の読み込み中にエラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCoupon();
  }, [user, adminState.isAdmin, params.id]);
  
  // 处理表单提交
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!user || !adminState.isAdmin) return;
    setErrorMessage(null);
    
    try {
      setIsSaving(true);
      
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/coupons/${params.id}`, {
        method: "PUT", // 使用PUT方法更新整个资源
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        // 更新成功，返回优惠券列表页面
        router.push("/admin/coupons");
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.error || "クーポン更新中にエラーが発生しました");
      }
    } catch (error) {
      console.error("Error updating coupon:", error);
      setErrorMessage("クーポン更新中にエラーが発生しました");
    } finally {
      setIsSaving(false);
    }
  };
  
  // 处理表单字段变化
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    if (type === "checkbox") {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === "discountType") {
      const newDiscountType = value as CouponDiscountType;
      const newDiscountValue = newDiscountType === CouponDiscountType.FIXED ? 1000 : 10;
      setFormData(prev => ({ 
        ...prev, 
        discountType: newDiscountType,
        discountValue: newDiscountValue
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // 处理多选变化
  const handleMultiSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions).map(option => option.value);
    setFormData(prev => ({ ...prev, [e.target.name]: options }));
  };
  
  // 加载状态
  if (loading || !adminState.checkComplete) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
        </div>
      </Layout>
    );
  }
  
  // 未登录
  if (!user) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic mb-4">
            管理者ページにアクセスするには、ログインしてください。
          </p>
          <button
            onClick={() => router.push(`/login?returnTo=/admin/coupons/edit/${params.id}`)}
            className="px-6 py-2 bg-[#444444] text-white rounded-full text-sm tracking-wide font-zen-kaku-gothic hover:bg-[#333333] transition-colors"
          >
            ログイン
          </button>
        </div>
      </Layout>
    );
  }
  
  // 无权限
  if (!adminState.isAdmin) {
    return (
      <Layout>
        <div className="max-w-[920px] mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm font-zen-kaku-gothic">
            このページにアクセスする権限がありません。
          </p>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <AdminLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-300 pb-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wider font-zen-kaku-gothic">
              クーポン編集
            </h1>
          </div>
          
          {/* 错误消息显示 */}
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700 text-sm font-zen-kaku-gothic">{errorMessage}</p>
            </div>
          )}
          
          {isLoading ? (
            <div className="bg-white p-6 rounded shadow-sm border border-gray-100 text-center py-12">
              <p className="text-gray-500 font-zen-kaku-gothic">クーポン情報を読み込み中...</p>
            </div>
          ) : (
            <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">クーポンコード <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">クーポン名 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">説明</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      rows={2}
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">有効期間開始 <span className="text-red-500">*</span></label>
                    <input
                      type="datetime-local"
                      name="validFrom"
                      value={formData.validFrom}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">有効期間終了 <span className="text-red-500">*</span></label>
                    <input
                      type="datetime-local"
                      name="validTo"
                      value={formData.validTo}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">割引タイプ <span className="text-red-500">*</span></label>
                    <select
                      name="discountType"
                      value={formData.discountType}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    >
                      <option value="fixed">定額割引</option>
                      <option value="percentage">パーセント割引</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">
                      {formData.discountType === "fixed" ? "割引金額 (円)" : "割引率 (%)"}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="discountValue"
                      value={formData.discountValue}
                      onChange={handleChange}
                      required
                      min={formData.discountType === "fixed" ? "1" : "1"}
                      max={formData.discountType === "percentage" ? "100" : ""}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>

                  {/* 根据折扣类型显示不同的字段 */}
                  {formData.discountType === "fixed" ? (
                    <div>
                      <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">最低注文金額 (円)</label>
                      <input
                        type="number"
                        name="minAmount"
                        value={formData.minAmount}
                        onChange={handleChange}
                        min="0"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">最大割引金額 (円)</label>
                      <input
                        type="number"
                        name="maxDiscount"
                        value={formData.maxDiscount}
                        onChange={handleChange}
                        min="0"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1 font-zen-kaku-gothic">0の場合、上限なし</p>
                    </div>
                  )}
                  
                  {/* 百分比折扣时在下一行显示最低订单金额 */}
                  {formData.discountType === "percentage" && (
                    <div>
                      <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">最低注文金額 (円)</label>
                      <input
                        type="number"
                        name="minAmount"
                        value={formData.minAmount}
                        onChange={handleChange}
                        min="0"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">総使用回数制限</label>
                    <input
                      type="number"
                      name="usageLimit"
                      value={formData.usageLimit}
                      onChange={handleChange}
                      min="-1"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1 font-zen-kaku-gothic">-1の場合、無制限</p>
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">ユーザーごとの使用回数制限</label>
                    <input
                      type="number"
                      name="perUserLimit"
                      value={formData.perUserLimit}
                      onChange={handleChange}
                      min="-1"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1 font-zen-kaku-gothic">-1の場合、無制限</p>
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm text-gray-700 font-zen-kaku-gothic">適用可能な部屋タイプ</label>
                    <select
                      name="applicableRoomTypes"
                      value={formData.applicableRoomTypes}
                      onChange={handleMultiSelect}
                      multiple
                      className="w-full border border-gray-300 rounded px-3 py-2 h-32 text-sm"
                    >
                      <option value="tototo">TOTOTO</option>
                      <option value="fuuu">FUUU</option>
                      <option value="zabuun">ZABUUN</option>
                      <option value="toron">TORON</option>
                      <option value="sauna_suite">サウナスイート</option>
                      <option value="slow_room">スロールーム</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1 font-zen-kaku-gothic">Ctrlキーを押しながら複数選択可能。空の場合、全ての部屋タイプに適用</p>
                  </div>
                  
                  <div className="md:col-span-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="isFirstTimeOnly"
                        checked={formData.isFirstTimeOnly}
                        onChange={handleChange}
                        id="isFirstTimeOnly"
                        className="h-4 w-4"
                      />
                      <label htmlFor="isFirstTimeOnly" className="text-sm text-gray-700 font-zen-kaku-gothic">初回予約のみ使用可能</label>
                    </div>
                    
                    <div className="flex items-center space-x-2 mt-2">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleChange}
                        id="isActive"
                        className="h-4 w-4"
                      />
                      <label htmlFor="isActive" className="text-sm text-gray-700 font-zen-kaku-gothic">有効</label>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => router.push("/admin/coupons")}
                    className="px-6 py-2 border border-gray-300 rounded-full text-gray-700 text-sm tracking-wide font-zen-kaku-gothic hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`px-6 py-2 rounded-full text-white text-sm tracking-wide font-zen-kaku-gothic ${
                      isSaving ? "bg-gray-400" : "bg-[#444444] hover:bg-[#333333] transition-colors"
                    }`}
                  >
                    {isSaving ? "保存中..." : "保存"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </AdminLayout>
    </Layout>
  );
} 