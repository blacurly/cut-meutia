import AuthLayout from "@/components/layout/AuthLayout";
import { normalizeAuthQuery } from "@/lib/auth";
import AuthForm from "./AuthForm";

export default async function AuthPage({ mode, searchParams }) {
  const params = await searchParams;
  const { language, role } = normalizeAuthQuery(params);
  const initialAuthMessage = {
    "recovery-expired": "recoveryLinkExpired",
    "confirmation-error": "confirmationError",
  }[params?.auth] || null;
  return (
    <AuthLayout language={language} role={role} mode={mode}>
      <AuthForm key={`${mode}:${language}:${initialAuthMessage || ""}`} language={language} role={role} mode={mode} initialAuthMessage={initialAuthMessage} />
    </AuthLayout>
  );
}
