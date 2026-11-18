import localFont from "next/font/local";
import "./globals.css";
import ParentDemoProvider from "@/components/features/ParentDemoProvider";
import ParentShell from "@/components/layout/ParentShell";
import SessionProvider from "@/components/session/SessionProvider";

const jakartaSans = localFont({
  src: "../public/fonts/PlusJakartaSans-Variable.ttf",
  variable: "--font-jakarta-sans",
  weight: "200 800",
  style: "normal",
  display: "swap",
});

export const metadata = {
  title: "Ayomi — Pengasuhan Transparan. Orang Tua Tenang.",
  description: "Direktori daycare di DKI Jakarta, Jawa Barat, dan Jawa Timur dengan pendaftaran online, logbook harian, dan Foto Fokus Anak untuk privasi.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="id"
      className={`${jakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><ParentDemoProvider><SessionProvider><ParentShell>{children}</ParentShell></SessionProvider></ParentDemoProvider></body>
    </html>
  );
}
