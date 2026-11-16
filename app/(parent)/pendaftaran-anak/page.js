import { EnrollmentNew } from "@/components/live/ParentPages";

export const metadata = { title: "Pendaftaran Anak | Ayomi" };
export default async function EnrollmentPage({ searchParams }) {
  const { daycare } = await searchParams;
  return <EnrollmentNew daycareKey={typeof daycare === "string" ? daycare : ""} />;
}
