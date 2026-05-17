import "./globals.css";

export const metadata = {
  title: "富贵 MyInvois — 电子发票管理",
  description: "马来西亚 LHDN 电子发票自动提交系统",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
