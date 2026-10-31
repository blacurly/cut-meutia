import localFont from "next/font/local";
import "./globals.css";
import ParentDemoProvider from "@/components/features/ParentDemoProvider";
import ParentShell from "@/components/layout/ParentShell";

const jakartaSans = localFont({
  src: "../public/fonts/PlusJakartaSans-Variable.ttf",
  variable: "--font-jakarta-sans",
  weight: "200 800",
  style: "normal",
  display: "swap",
});

export const metadata = {
  title: "Ayomi — Pengasuhan Transparan. Orang Tua Tenang.",
  description: "Direktori daycare terverifikasi di 34+ provinsi dengan AI Safety Score, logbook aktivitas real-time, dan proteksi privasi otomatis.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="id"
      className={`${jakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><ParentDemoProvider><ParentShell>{children}</ParentShell></ParentDemoProvider></body>
    </html>
  );
}
