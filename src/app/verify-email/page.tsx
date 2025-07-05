"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import { getTempReservationById } from "@/utils/tempReservation";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [hasReservation, setHasReservation] = useState(false);
  const [isRestoringReservation, setIsRestoringReservation] = useState(false);

  // 通过ID从Firestore恢复预约信息
  const restoreReservationInfo = async (id: string): Promise<boolean> => {
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
  };

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");
      const urlReservationId = searchParams.get("reservationId");
      const localReservationId = localStorage.getItem("reservationId");

      if (!token) {
        setStatus("error");
        setMessage("無効なリンクです");
        return;
      }

      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage("メールアドレスの確認が完了しました");
          
          // 尝试恢复预约数据
          const effectiveReservationId = urlReservationId || localReservationId;
          if (effectiveReservationId) {
            await restoreReservationInfo(effectiveReservationId);
          } else {
            // 检查localStorage中是否直接有预约信息
            const localInfo = localStorage.getItem("reservationInfo");
            if (localInfo) {
              setHasReservation(true);
            }
          }
        } else {
          setStatus("error");
          setMessage(data.error || "確認に失敗しました");
        }
      } catch (error) {
        setStatus("error");
        setMessage("エラーが発生しました");
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
        {(status === "loading" || isRestoringReservation) && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600 font-zen-kaku-gothic">
              {isRestoringReservation ? "予約情報を復元中..." : "確認中..."}
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-2 font-zen-kaku-gothic">
              確認完了
            </h1>
            <p className="text-gray-600 font-zen-kaku-gothic">{message}</p>
            
            <div className="mt-6">
              {hasReservation ? (
                <button
                  onClick={() => {
                    const auth = getAuth();
                    if (auth.currentUser && auth.currentUser.emailVerified) {
                      // 已登录且邮箱已验证，直接前往预约确认页面
                      router.push("/reservation/confirm");
                    } else {
                      // 未登录或邮箱未验证，先前往登录页面
                      router.push("/login?returnTo=/reservation/confirm");
                    }
                  }}
                  className="px-6 py-2 bg-[#444444] text-white rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic"
                >
                  予約を続ける
                </button>
              ) : (
                <button
                  onClick={() => router.push("/login")}
                  className="px-6 py-2 bg-[#444444] text-white rounded-full hover:bg-[#333333] transition-colors font-zen-kaku-gothic"
                >
                  ログインページへ
                </button>
              )}
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-2 font-zen-kaku-gothic">
              確認失敗
            </h1>
            <p className="text-gray-600 font-zen-kaku-gothic mb-6">{message}</p>
            
            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full px-4 py-2 bg-[#444444] text-white rounded-full hover:bg-[#333333] transition-colors text-center font-zen-kaku-gothic"
              >
                ログインページへ
              </Link>
              
              {message.includes("有効期限") && (
                <p className="text-sm text-gray-500 font-zen-kaku-gothic">
                  ログイン後、メール認証画面から再送信できます
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600 font-zen-kaku-gothic">読み込み中...</p>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}