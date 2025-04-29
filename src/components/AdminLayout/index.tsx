"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  // 管理菜单项
  const menuItems = [
    { name: "客室管理", path: "/admin/rooms" },
    { name: "お問い合わせ管理", path: "/admin/contacts" },
    { name: "予約管理", path: "/admin/reservations" },
    { name: "テスト用カード発行", path: "/admin/cards" },
    { name: "お客様カード発行", path: "/admin/card-issue" },
    { name: "ユーザー管理", path: "/admin/users" },
    { name: "クーポン管理", path: "/admin/coupons" },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 md:py-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
        {/* サイドバー */}
        <div className="col-span-1 bg-[#F0EAE4] p-4 rounded-lg border border-gray-200">
          <h2 className="text-lg font-bold text-gray-700 mb-4 font-zen-kaku-gothic">
            管理メニュー
          </h2>
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`block px-3 py-2 rounded-md text-sm font-zen-kaku-gothic ${
                  pathname === item.path
                    ? "bg-[#AB9F8D] text-white"
                    : "text-gray-700 hover:bg-[#E5DFD9]"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <Link
              href="/"
              className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-[#E5DFD9] font-zen-kaku-gothic"
            >
              サイトに戻る
            </Link>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="col-span-1 md:col-span-3 bg-white p-4 md:p-6 rounded-lg border border-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
}
