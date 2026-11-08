import DaycareSearch from "@/components/features/DaycareSearch";
import { parseDirectoryFilters } from "@/lib/daycare-directory";
export const metadata={title:"Direktori Daycare | Ayomi"};
export default async function SearchPage({searchParams}) {const filters=parseDirectoryFilters(await searchParams);return <DaycareSearch key={JSON.stringify(filters)} initialFilters={filters}/>;}
