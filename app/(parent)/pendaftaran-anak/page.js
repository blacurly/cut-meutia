import EnrollmentForm from "@/components/features/EnrollmentForm";
export const metadata={title:"Pendaftaran Anak | Ayomi"};
export default async function EnrollmentPage({searchParams}){const {daycare}=await searchParams;return <EnrollmentForm key={typeof daycare==="string"?daycare:"empty"} daycareId={typeof daycare==="string"?daycare:""}/>;}
