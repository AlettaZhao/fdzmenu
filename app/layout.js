import './globals.css';

export const metadata = {
  title: '饭搭子 FanDaZi — 看菜单 · 挑好吃的',
  description: '拍菜单 · 懂你口味 · 帮你点餐。对着菜单发愁？让饭搭子帮你看懂、挑对、点到位。',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  themeColor: '#C43E1C',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}