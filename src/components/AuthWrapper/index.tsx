"use client";

import { useEffect } from "react";
import { setupAuthListener } from "@/utils/auth";

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // 设置Firebase认证状态监听器
    const unsubscribe = setupAuthListener();

    // 清理函数
    return () => unsubscribe();
  }, []);

  return <>{children}</>;
}
