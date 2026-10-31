import { notFound } from "next/navigation";
import DaycareDetail from "@/components/features/DaycareDetail";
import { getDaycare } from "@/lib/parent";
export async function generateMetadata({params}) {const {id}=await params;return {title:`${getDaycare(id)?.name || "Daycare tidak ditemukan"} | Ayomi`};}
export default async function DetailPage({params}) {const {id}=await params;const daycare=getDaycare(id);if(!daycare)notFound();return <DaycareDetail daycare={daycare}/>;}
