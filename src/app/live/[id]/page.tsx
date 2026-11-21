import { notFound } from "next/navigation";
import { LiveShopping } from "@/components/live-shopping";
import { getBusinessById, getLiveSessionById } from "@/lib/data";

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getLiveSessionById(id);
  if (!session) notFound();
  const business = await getBusinessById(session.business_id);
  if (!business) notFound();
  return <LiveShopping session={session} storeSlug={business.slug} businessName={business.name} />;
}

export const instant = false
