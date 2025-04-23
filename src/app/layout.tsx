import type { Metadata } from "next";
import "./globals.css";
import AuthWrapper from "@/components/AuthWrapper";

// 定义CSS变量供全局使用
const fontFallback = 'var(--font-zen-kaku-gothic, "Helvetica Neue", Arial, sans-serif)';

export const metadata: Metadata = {
  title: "etoe hotel booking",
  description: "Book your stay at Etoe Hotel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --font-zen-kaku-gothic: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
          }
        `}} />
      </head>
      <body
        className="antialiased"
        suppressHydrationWarning
        style={{ fontFamily: fontFallback }}
      >
        <AuthWrapper>{children}</AuthWrapper>
      </body>
    </html>
  );
}
