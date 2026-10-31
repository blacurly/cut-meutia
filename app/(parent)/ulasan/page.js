import { ParentReviews } from "@/components/features/ParentAccount";
export const metadata={title:"Ulasan Orang Tua | Ayomi"};
export default async function ReviewsPage({searchParams}){const {daycare}=await searchParams;return <ParentReviews daycareId={typeof daycare==="string"?daycare:""}/>;}
