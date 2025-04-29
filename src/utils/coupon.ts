// 優惠券代碼驗證邏輯
export function validateCouponCode(code: string): boolean {
  // 目前僅檢查非空，未來可擴充格式或API驗證
  return code.trim() !== "";
} 