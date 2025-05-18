"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import Layout from "@/components/Layout";
import { 
  getTempReservationById
} from "@/utils/tempReservation";

function EmailVerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [hasReservation, setHasReservation] = useState(false);
  const [isRestoringReservation, setIsRestoringReservation] = useState(false);
  const effectExecutedRef = useRef(false);

  // 通过ID从Firestore恢复预约信息
  const restoreReservationInfo = useCallback(async (id: string): Promise<boolean> => {
    setIsRestoringReservation(true);
    
    try {
      console.log("正在通过ID恢复预约信息:", id);
      
      const reservationData = await getTempReservationById(id);
      
      if (reservationData) {
        console.log("成功获取预约数据");
        
        localStorage.setItem("reservationInfo", reservationData);
        localStorage.setItem("reservationId", id);
        setHasReservation(true);
        
        console.log("预约信息已保存到localStorage");
        return true;
      } else {
        console.warn("未能找到预约数据，ID:", id);
        return false;
      }
    } catch (error) {
      console.error("Failed to restore reservation info:", error);
      return false;
    } finally {
      setIsRestoringReservation(false);
    }
  }, []);

  // 简化后的恢复预约数据函数
  const restoreReservationData = useCallback(async (
    urlReservationId: string | null, 
    localReservationId: string | null
  ) => {
    try {
      console.log("尝试恢复预约数据...");
      
      // 优先使用URL中的预约ID
      const effectiveReservationId = urlReservationId || localReservationId;
      
      if (effectiveReservationId) {
        console.log("使用预约ID恢复数据:", effectiveReservationId);
        const success = await restoreReservationInfo(effectiveReservationId);
        if (success) return;
      }
      
      // 如果没有预约ID或恢复失败，检查localStorage中是否直接有预约信息
      const localInfo = localStorage.getItem("reservationInfo");
      if (localInfo) {
        console.log("在localStorage中直接找到预约信息");
        setHasReservation(true);
        return;
      }
      
      console.log("无法恢复预约数据");
      setHasReservation(false);
    } catch (error) {
      console.error("恢复预约数据时出错:", error);
      // 即使出错，仍检查localStorage
      const localInfo = localStorage.getItem("reservationInfo");
      setHasReservation(!!localInfo);
    }
  }, [restoreReservationInfo]);

  useEffect(() => {
    if (effectExecutedRef.current) return;
    effectExecutedRef.current = true;
    
    const checkTemporaryEmail = () => {
      const tempEmail = localStorage.getItem("tempUserEmail");
      if (tempEmail) setEmail(tempEmail);
    };

    checkTemporaryEmail();

    const verifyEmail = async () => {
      const oobCode = searchParams.get("oobCode");
      const reservationId = searchParams.get("reservationId");
      
      // 尝试从localStorage获取预约ID（适用于同设备场景）
      const localReservationId = localStorage.getItem("reservationId");
      
      // 增加调试信息
      console.log("验证参数:", { 
        oobCode, 
        reservationId,
        localReservationId,
        allParams: Object.fromEntries(searchParams.entries())
      });
      
      if (!oobCode) {
        setStatus("error");
        setErrorMessage("認証コードが存在しないか、期限切れです。");
        return;
      }

      try {
        const auth = getAuth();
        console.log("验证前的登录状态:", auth.currentUser ? 
          `已登录(${auth.currentUser.email}, 已验证:${auth.currentUser.emailVerified})` : 
          "未登录");
        
        // 通过API进行邮箱验证，而不是直接调用Firebase
        try {
          // 调用邮箱验证API
          const response = await fetch('/api/verify-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ oobCode })
          });
          
          const result = await response.json();
          
          if (!response.ok || !result.success) {
            throw new Error(result.error || "メール認証に失敗しました");
          }
          
          console.log("邮箱验证成功");
          
          // 如果用户已登录，刷新用户状态以更新emailVerified字段
          if (auth.currentUser) {
            await auth.currentUser.reload();
            console.log("用户状态已刷新:", auth.currentUser.emailVerified ? "已验证" : "未验证");
          }
        } catch (verifyError: any) {
          console.error("验证API调用失败:", verifyError);
          if (auth.currentUser) {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
              console.log("用户邮箱已经通过验证");
            } else {
              throw verifyError;
            }
          } else {
            throw verifyError;
          }
        }
        
        setStatus("success");
        
        // 尝试恢复预约数据
        await restoreReservationData(reservationId, localReservationId);
        
      } catch (error: any) {
        console.error("メール認証に失敗しました:", error);
        setStatus("error");
        
        // 详细记录错误信息
        console.error("错误详情:", {
          code: error.code,
          message: error.message,
          stack: error.stack
        });
        
        // 错误处理
        if (error.code === "auth/invalid-action-code") {
          setErrorMessage("認証リンクが無効または期限切れです。再度登録を行うか、新しい認証メールを送信してください。");
        } else if (error.code === "auth/user-disabled") {
          setErrorMessage("ユーザーアカウントが無効になっています。");
        } else if (error.code === "auth/user-not-found") {
          setErrorMessage("ユーザーが存在しません。");
        } else {
          setErrorMessage(`メール認証中にエラーが発生しました。(${error.code || "unknown"})`);
        }
      }
    };

    verifyEmail();
  }, [searchParams, restoreReservationData]);

  // 处理继续预约按钮点击
  const handleContinueReservation = async () => {
    try {
      console.log("尝试继续预约流程");
      
      // 检查是否有预约信息
      const hasLocalReservation = !!localStorage.getItem("reservationInfo");
      
      if (!hasLocalReservation) {
        console.warn("在localStorage中找不到预约信息");
      }
      
      // 判断当前是否已登录用户
      const auth = getAuth();
      if (auth.currentUser && auth.currentUser.emailVerified) {
        // 已登录且邮箱已验证，直接前往预约确认页面
        console.log("用户已登录，跳转到预约确认页面");
        router.push("/reservation/confirm");
      } else {
        // 未登录或邮箱未验证，先前往登录页面
        console.log("用户未登录或邮箱未验证，跳转到登录页面");
        
        // 如果保存了邮箱，在URL中携带邮箱信息
        const loginUrl = email 
          ? `/login?email=${encodeURIComponent(email)}&returnTo=/reservation/confirm` 
          : `/login?returnTo=/reservation/confirm`;
        
        router.push(loginUrl);
        
        // 清除临时保存的邮箱
        if (email) {
          localStorage.removeItem("tempUserEmail");
        }
      }
    } catch (error) {
      console.error("予約継続中にエラーが発生しました:", error);
      alert("エラーが発生しました。ログイン画面に移動します。");
      router.push("/login?returnTo=/reservation/confirm");
    }
  };

  return (
    <div className="max-w-md p-6 bg-white rounded-lg shadow-md mt-10 mx-4 sm:mx-6 md:mx-auto">
      {status === "loading" || isRestoringReservation ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mx-auto mb-4"></div>
          <p className="text-[#444444] font-zen-kaku-gothic">
            メールアドレスを認証中です...
          </p>
        </div>
      ) : status === "success" ? (
        <>
          <h1 className="text-2xl font-bold text-[#444444] mb-4 text-center font-zen-kaku-gothic">
            メール認証成功
          </h1>
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
            <p className="text-green-700 font-zen-kaku-gothic">
              メールアドレスの認証が完了しました！
            </p>
          </div>
          <div className="text-center space-y-4">
            <button
              onClick={handleContinueReservation}
              className="bg-[#444444] text-white py-2 px-6 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic"
            >
              {hasReservation ? "予約を続ける" : "ログインへ"}
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-[#444444] mb-4 text-center font-zen-kaku-gothic">
            メール認証失敗
          </h1>
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-red-700 font-zen-kaku-gothic">{errorMessage}</p>
          </div>
          <div className="text-center space-y-4">
            <button
              onClick={() => router.push("/login")}
              className="bg-[#444444] text-white py-2 px-6 rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic"
            >
              ログインへ戻る
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function EmailVerificationPage() {
  return (
    <Layout>
      <Suspense fallback={
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mx-auto mb-4"></div>
          <p className="text-[#444444] font-zen-kaku-gothic">読み込み中...</p>
        </div>
      }>
        <EmailVerificationContent />
      </Suspense>
    </Layout>
  );
} 