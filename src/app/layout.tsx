import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentMeter",
  description: "Local-first Codex and workspace token analytics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
