"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import Login from "@/components/Login";

function LoginContent() {
  return (
    <Layout>
      <div className="max-w-[920px] mx-auto py-8 md:py-12 px-4 md:px-0">
        <Login />
      </div>
    </Layout>
  );
}

export default function LoginPage() {
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
      <LoginContent />
    </Suspense>
  );
}
