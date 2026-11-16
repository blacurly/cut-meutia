import { ParentLogbookPage } from "@/components/live/ParentPages";

export const metadata = { title: "Logbook Harian Anak | Ayomi" };
export default async function LogbookPage({ searchParams }) {
  const { enrollment } = await searchParams;
  return <ParentLogbookPage enrollmentId={typeof enrollment === "string" ? enrollment : ""} />;
}
