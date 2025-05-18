"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthActionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reservationId, setReservationId] = useState<string | null>(null);
  // 防止重复执行
  const effectExecutedRef = useRef(false);
  // 调试信息
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    // 检查是否已经执行过，防止重复执行
    if (effectExecutedRef.current) return;
    effectExecutedRef.current = true;
    
    // 处理重定向逻辑
    const handleRedirect = () => {
      try {
        console.log("开始处理重定向");
        
        // 获取URL参数
        const mode = searchParams.get("mode");
        const oobCode = searchParams.get("oobCode");
        
        // 从URL中获取continueUrl参数
        const continueUrl = searchParams.get("continueUrl");
        let reservationInfo = null;
        
        // 如果存在continueUrl，尝试从中提取reservationInfo
        if (continueUrl) {
          try {
            const continueUrlObj = new URL(continueUrl);
            reservationInfo = continueUrlObj.searchParams.get("reservationInfo");
            console.log("从continueUrl中提取到reservationInfo:", reservationInfo);
          } catch (error) {
            console.error("解析continueUrl失败:", error);
          }
        } else {
          // 如果没有continueUrl，直接尝试获取reservationInfo
          reservationInfo = searchParams.get("reservationInfo");
        }
        
        // 尝试从localStorage获取预约ID（适用于同设备场景）
        const localReservationId = localStorage.getItem("reservationId");

        console.log("验证链接参数:", { 
          mode, 
          oobCode, 
          continueUrl,
          reservationInfo,
          localReservationId
        });

        if (!oobCode) {
          setError("無効な操作リンクです。認証コードがありません。");
          setLoading(false);
          return;
        }

        // 优先使用URL中的预约信息ID，如果没有则使用localStorage中的
        const effectiveReservationId = reservationInfo || localReservationId;
        
        // 如果有有效的预约信息ID，保存它
        if (effectiveReservationId) {
          setReservationId(effectiveReservationId);
          // 保存到localStorage，以便同设备场景
          localStorage.setItem("reservationId", effectiveReservationId);
          console.log("已保存预约ID到localStorage:", effectiveReservationId);
        } else {
          console.log("未检测到预约信息ID");
        }

        // 执行重定向
        try {
          // 根据mode参数重定向到不同页面
          if (mode === "resetPassword") {
            // 重定向到密码重置页面
            const redirectUrl = `/reset-password?oobCode=${oobCode}`;
            router.push(redirectUrl);
          } else if (mode === "verifyEmail") {
            // 重定向到邮箱验证页面
            let redirectUrl = `/email-verification?oobCode=${oobCode}`;
            
            // 如果有预约信息ID，添加到URL
            if (effectiveReservationId) {
              redirectUrl += `&reservationId=${encodeURIComponent(effectiveReservationId)}`;
            }
            
            console.log("重定向到:", redirectUrl);
            
            // 使用Next.js的router进行跳转
            router.push(redirectUrl);
          } else {
            setError("不明な操作タイプです。");
            setLoading(false);
          }
        } catch (redirectError: any) {
          console.error("重定向失败:", redirectError);
          setError(`リダイレクト中にエラーが発生しました: ${redirectError.message || "未知错误"}`);
          setLoading(false);
        }
      } catch (error: any) {
        console.error("处理验证链接时出错:", error);
        setError(`処理中にエラーが発生しました: ${error.message || "未知错误"}`);
        setLoading(false);
      }
    };

    // 执行重定向
    handleRedirect();
  }, [router, searchParams]);

  // 显示加载状态
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mb-4"></div>
        <p className="text-gray-600">読み込み中...</p>
        {debugInfo && (
          <p className="text-xs text-gray-500 mt-4 max-w-md text-center">
            {debugInfo}
          </p>
        )}
      </div>
    );
  }

  // 显示错误信息
  if (error) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
        <h1 className="text-2xl font-bold text-[#444444] mb-4 text-center font-zen-kaku-gothic">
          操作に失敗しました
        </h1>
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700 font-zen-kaku-gothic">{error}</p>
        </div>
        <div className="text-center">
          <button
            onClick={() => router.push("/")}
            className="bg-[#444444] text-white py-2 px-6 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic"
          >
            ホームページへ戻る
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function AuthActionHandler() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700"></div>
      </div>
    }>
      <AuthActionContent />
    </Suspense>
  );
} 