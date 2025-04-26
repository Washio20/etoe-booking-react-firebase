"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/utils/firebase";
import { logoutUser } from "@/utils/auth";

const Navbar = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 监听Firebase认证状态
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 处理登录 - 导航到登录页面
  const handleLogin = () => {
    router.push("/login");
  };

  // 处理注册 - 导航到注册页面
  const handleRegister = () => {
    router.push("/register");
  };

  // 处理登出 - 使用Firebase登出
  const handleLogout = async () => {
    try {
      await logoutUser();
      router.push("/");
    } catch (error) {
      console.error("登出错误:", error);
    }
  };

  const navItems = [
    { name: "施設予約", href: "/" },
    { name: "予約一覧", href: "/reservations", requireLogin: true },
    { name: "会員情報", href: "/member", requireLogin: true },
    // { name: "利用ガイド", href: "/guide" },
    // { name: "よくある質問", href: "/faq" },
    { name: "お問い合わせ", href: "/contact" },
  ];

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // 当菜单打开时禁止背景滚动
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [mobileMenuOpen]);

  return (
    <nav className="bg-[#FAF9F7] w-full pt-8 pb-8 sm:pt-4 sm:pb-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0">
            <Link href="/">
              <Image
                src="/images/logo.svg"
                alt="etoe hotel"
                width={120}
                height={40}
                priority
              />
            </Link>
          </div>
          <div className="hidden md:flex md:flex-1 md:justify-center">
            <div className="flex space-x-6">
              {navItems
                .filter((item) => !item.requireLogin || !!user)
                .map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="inline-flex items-center px-1 pt-1 text-base font-medium text-[#444444] hover:text-gray-900 font-zen-kaku-gothic"
                  >
                    {item.name}
                  </Link>
                ))}
            </div>
          </div>
          <div className="hidden md:flex md:items-center md:space-x-2">
            {isLoading ? (
              <span className="text-gray-500 text-sm">読み込み中...</span>
            ) : user ? (
              <>
                <Link
                  href="/passcode"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#444444] rounded-full hover:bg-[#333333]"
                >
                  入室パスコード
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#444444] rounded-full hover:bg-[#333333]"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#444444] rounded-full hover:bg-[#333333]"
                >
                  ログイン
                </button>
                <button
                  onClick={handleRegister}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#444444] rounded-full hover:bg-[#333333]"
                >
                  会員登録
                </button>
              </>
            )}
          </div>

          {/* 手机端汉堡菜单按钮 */}
          <div className="md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center p-2 rounded-full border border-[#444444] text-[#444444]"
              aria-expanded={mobileMenuOpen}
            >
              <span className="sr-only">メニューを開く</span>
              <div className="w-6 h-6 flex flex-col justify-center items-center space-y-1">
                {mobileMenuOpen ? (
                  // X形状的关闭按钮
                  <>
                    <span className="block w-5 h-0.5 bg-[#444444] rotate-45 absolute"></span>
                    <span className="block w-5 h-0.5 bg-[#444444] -rotate-45 absolute"></span>
                  </>
                ) : (
                  // 汉堡菜单图标
                  <>
                    <span className="block w-5 h-0.5 bg-[#444444]"></span>
                    <span className="block w-5 h-0.5 bg-[#444444]"></span>
                    <span className="block w-5 h-0.5 bg-[#444444]"></span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 移动端菜单 - 修改为全屏样式 */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-white z-50 flex flex-col pt-20 pb-10 px-6 overflow-y-auto">
          {/* 菜单关闭按钮 - 位于右上角 */}
          <button
            onClick={toggleMobileMenu}
            className="absolute top-6 right-6 inline-flex items-center justify-center p-2 rounded-full border border-[#444444] text-[#444444]"
          >
            <span className="sr-only">メニューを閉じる</span>
            <div className="w-6 h-6 flex items-center justify-center">
              <span className="block w-5 h-0.5 bg-[#444444] rotate-45 absolute"></span>
              <span className="block w-5 h-0.5 bg-[#444444] -rotate-45 absolute"></span>
            </div>
          </button>

          {/* Logo显示在菜单顶部 */}
          <div className="mb-10">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <Image
                src="/images/logo.svg"
                alt="etoe hotel"
                width={120}
                height={40}
                priority
              />
            </Link>
          </div>

          {/* 导航项目 */}
          <div className="flex flex-col">
            {navItems
              .filter((item) => !item.requireLogin || !!user)
              .map((item, index) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 border-b border-[rgba(68,68,68,0.2)] text-sm font-bold text-[#444444] font-zen-kaku-gothic"
                >
                  {item.name}
                </Link>
              ))}
          </div>

          {/* 身份验证按钮区域 */}
          <div className="mt-auto flex flex-col space-y-3">
            {isLoading ? (
              <span className="text-gray-500 text-sm">読み込み中...</span>
            ) : user ? (
              <>
                <Link
                  href="/passcode"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#444444] rounded-full hover:bg-[#333333]"
                >
                  入室パスコード
                </Link>
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await handleLogout();
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#444444] rounded-full hover:bg-[#333333]"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogin();
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#444444] rounded-full hover:bg-[#333333]"
                >
                  ログイン
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleRegister();
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#444444] rounded-full hover:bg-[#333333]"
                >
                  会員登録
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
