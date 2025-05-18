import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthWrapper from "@/components/AuthWrapper";
import Script from "next/script";

// 定义CSS变量供全局使用
const fontFallback = 'var(--font-zen-kaku-gothic, "Helvetica Neue", Arial, sans-serif)';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "etoe sauna & body communication",
  description: "etoe hotelで快適なご宿泊とサウナ体験をお楽しみください。高品質の客室、本格的なサウナ施設、上質なサービスをご提供します。",
  keywords: "etoe hotel, サウナ, 日本のホテル, 高級宿泊施設, オンライン予約",
  authors: [{ name: "etoe hotel" }],
  generator: "Next.js",
  applicationName: "etoe hotel & Sauna Booking",
  referrer: "origin-when-cross-origin",
  creator: "etoe hotel",
  publisher: "etoe hotel",
  icons: {
    icon: "/images/favicon.ico",
    shortcut: "/images/favicon.ico",
    apple: "/images/favicon.ico",
  },
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "etoe sauna & body communication",
    description: "etoe hotelで快適なご宿泊とサウナ体験をお楽しみください。高品質の客室、本格的なサウナ施設、上質なサービスをご提供します。",
    url: "https://book.etoehotel.com",
    siteName: "etoe hotel & Sauna",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "etoe sauna & body communication",
    description: "etoe hotelで快適なご宿泊とサウナ体験をお楽しみください。高品質の客室、本格的なサウナ施設、上質なサービスをご提供します。",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        {/* Google Tag Manager */}
        <Script
          id="gtm-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5MJXML8P');`,
          }}
        />
        {/* End Google Tag Manager */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --font-zen-kaku-gothic: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
          }
        `}} />
        <link rel="icon" href="/images/favicon.ico" />
        <link rel="shortcut icon" href="/images/favicon.ico" />
        <link rel="apple-touch-icon" href="/images/favicon.ico" />
      </head>
      <body
        className="antialiased"
        suppressHydrationWarning
        style={{ fontFamily: fontFallback }}
      >
        {/* Google Tag Manager (noscript) */}
        <noscript dangerouslySetInnerHTML={{ __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5MJXML8P"
height="0" width="0" style="display:none;visibility:hidden"></iframe>` }} />
        {/* End Google Tag Manager (noscript) */}
        <AuthWrapper>{children}</AuthWrapper>
      </body>
    </html>
  );
}
