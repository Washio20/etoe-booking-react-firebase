import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import AuthWrapper from "@/components/AuthWrapper";

const zenKakuGothicNew = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-zen-kaku-gothic",
});

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
    <html lang="ja" className={zenKakuGothicNew.variable}>
      <body
        className={`${zenKakuGothicNew.className} antialiased`}
        suppressHydrationWarning
      >
        <AuthWrapper>{children}</AuthWrapper>
      </body>
    </html>
  );
}
