import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "etoe hotel - カード情報",
  description: "お部屋の入室カード情報を確認できます",
};

export default function CardViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="font-sans">{children}</div>;
}
