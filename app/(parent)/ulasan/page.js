import { ReviewsPage } from "@/components/live/ParentPages";

export const metadata = { title: "Ulasan Orang Tua Ayomi" };
export default async function Page({ searchParams }) {
  const { enrollment } = await searchParams;
  return <ReviewsPage enrollmentId={typeof enrollment === "string" ? enrollment : ""} />;
}
