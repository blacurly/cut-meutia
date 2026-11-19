import AdminSafetyScore from "@/components/live/AdminSafetyScore";

export const metadata = { title: "Safety Score | Ayomi" };
export default async function Page({ params }) {
  const { id } = await params;
  return <AdminSafetyScore daycareId={id} />;
}
