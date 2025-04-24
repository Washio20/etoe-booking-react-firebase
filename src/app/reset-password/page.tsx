"use client";

import PasswordResetConfirm from "@/components/PasswordResetConfirm";
import Layout from "@/components/Layout";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 确保客户端渲染时能够获取URL参数
    setIsReady(true);
  }, [searchParams]);

  if (!isReady) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-[920px] mx-auto py-8 md:py-12 px-4 md:px-0">
        <PasswordResetConfirm />
      </div>
    </Layout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Layout>
          <div className="flex justify-center items-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700"></div>
          </div>
        </Layout>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
