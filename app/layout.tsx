import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./compact.css";
import "./quote-editor.css";
import "./row-density.css";
import "./refined-prices.css";
import "./catalog-table.css";
import "./screen-layout.css";
import "./quote-history-card.css";
import "./customers.css";
import "./settings-panel.css";
import "./quote-updates.css";
import "./quote-care.css";
import "./quote-print.css";
import "./customer-journal.css";
import KeyboardDone from './keyboard-done';
import ScreenBehavior from './screen-behavior';

export const viewport:Viewport={width:'device-width',initialScale:1,minimumScale:1,maximumScale:1,userScalable:false,viewportFit:'cover',interactiveWidget:'resizes-content'};

export const metadata: Metadata = {
  title: "Báo giá · Sùng Tuyến",
  description: "Bảng giá vật liệu xây dựng, báo giá nhanh và chăm sóc khách hàng.",
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
    <html lang="vi">
      <body className="antialiased"><KeyboardDone/><ScreenBehavior/>{children}</body>
    </html>
  );
}
