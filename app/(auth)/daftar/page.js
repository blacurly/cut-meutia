import AuthPage from "@/components/features/AuthPage";

export const metadata = {
  title: "Daftar Akun | Ayomi",
  description: "Buat akun orang tua atau pengelola daycare di Ayomi.",
  robots: { index: false, follow: false },
};

export default function RegisterPage({ searchParams }) {
  return <AuthPage mode="register" searchParams={searchParams} />;
}
