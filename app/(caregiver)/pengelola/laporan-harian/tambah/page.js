import { CaregiverLogbookForm } from "@/components/features/CaregiverLogbook";

export const metadata = { title: "Buat Logbook Harian | Ayomi" };
export default async function Page({searchParams}) {
  const params=await searchParams;
  const draftId=typeof params.draft==="string"?params.draft:"";
  return <CaregiverLogbookForm key={draftId} draftId={draftId}/>;
}
