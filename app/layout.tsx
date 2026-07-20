import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circuit Matgo | 디지털 맞고",
  description: "전자회로 화투로 즐기는 싱글 플레이 맞고 게임",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
