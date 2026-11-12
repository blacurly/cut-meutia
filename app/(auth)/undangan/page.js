import AuthLayout from "@/components/layout/AuthLayout";
import InvitationAccept from "@/components/features/InvitationAccept";

export const metadata = {
  title: "Undangan Staf | Ayomi",
  robots: { index: false, follow: false },
};

// /undangan#<token> — accept a staff invitation (Manager or Caregiver).
export default function InvitationPage() {
  return (
    <AuthLayout language="id" role="caregiver" mode="login">
      <InvitationAccept />
    </AuthLayout>
  );
}
