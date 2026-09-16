import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV Arcade | Webcam Mini Games",
  description: "웹캠으로 즐기는 짧은 Computer Vision 미니게임 아케이드",
  other: {
    "codex-preview": "development",
  },
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
