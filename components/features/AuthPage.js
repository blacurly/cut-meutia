import AuthLayout from "@/components/layout/AuthLayout";
import { normalizeAuthQuery } from "@/lib/auth";
import AuthForm from "./AuthForm";

export default async function AuthPage({ mode, searchParams }) {
  const { language, role } = normalizeAuthQuery(await searchParams);
  return (
    <AuthLayout language={language} role={role} mode={mode}>
      <AuthForm key={`${mode}:${language}`} language={language} role={role} mode={mode} />
    </AuthLayout>
  );
}
