import AuthPage from "@/components/features/AuthPage";

export const metadata = {
  title: "Masuk ke Akun | Ayomi",
  description: "Masuk sebagai orang tua, pengelola daycare, atau administrator Ayomi.",
  robots: { index: false, follow: false },
};

export default function SignInPage({ searchParams }) {
  return <AuthPage mode="login" searchParams={searchParams} />;
}
