"use client";

import Profile from "@/components/Profile";
import Layout from "@/components/Layout";

export default function MemberPage() {
  return (
    <Layout>
      <div className="max-w-[920px] mx-auto py-8 md:py-12 px-4 md:px-0">
        <Profile />
      </div>
    </Layout>
  );
}
