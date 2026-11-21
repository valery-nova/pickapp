import { notFound } from "next/navigation";
import { LiveRoom } from "@/components/live-room";
import { SiteHeader } from "@/components/site-header";
import { getBusinessById, getLiveSessionById } from "@/lib/data";

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getLiveSessionById(id);
  if (!session) notFound();
  const business = await getBusinessById(session.business_id);
  if (!business) notFound();
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <a href={`/store/${business.slug}`} className="text-sm font-medium text-red-700">← Volver a {business.name}</a>
        <div className="mt-4"><LiveRoom session={session} storeSlug={business.slug} /></div>
      </main>
    </div>
  );
}

export const instant = false
