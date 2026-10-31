import DaycareSearch from "@/components/features/DaycareSearch";
import { parseFilters } from "@/lib/parent";
export const metadata={title:"Direktori Daycare | Ayomi"};
export default async function SearchPage({searchParams}) {const filters=parseFilters(await searchParams);return <DaycareSearch key={JSON.stringify(filters)} initialFilters={filters}/>;}
