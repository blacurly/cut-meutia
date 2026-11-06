import AuthLayout from "@/components/layout/AuthLayout";
import PasswordUpdateForm from "@/components/features/PasswordUpdateForm";

export const metadata = {
  title: "Atur Ulang Kata Sandi | Ayomi",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const language = params?.lang === "en" ? "en" : "id";
  return (
    <AuthLayout language={language} role="parent" mode="login">
      <PasswordUpdateForm language={language} />
    </AuthLayout>
  );
}
