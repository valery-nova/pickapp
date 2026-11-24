import { notFound } from "next/navigation";
import { AssistantWidget } from "@/components/assistant-widget";
import { CatalogBrowser } from "@/components/catalog-browser";
import { SiteHeader } from "@/components/site-header";
import { getBusinessBySlug, getStoreCatalog, listPublicLiveSessions } from "@/lib/data";
import type { CatalogQuery } from "@/lib/data/contracts";

export default async function StorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; category?: string; inStock?: string; featured?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const query: CatalogQuery = {
    q: sp.q,
    category: sp.category,
    inStock: sp.inStock === "1",
    featured: sp.featured === "1",
  };
  const [products, liveSessions] = await Promise.all([getStoreCatalog(business.id, query), listPublicLiveSessions(business.id)]);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-40 bg-gradient-to-r from-red-600 to-red-400 sm:h-52">
            {business.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.cover_url} alt={business.name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            {business.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logo_url} alt={business.name} className="h-20 w-20 rounded-2xl border border-slate-200 object-cover" />
            ) : null}
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">{business.category || "Tienda"}</p>
              <h1 className="text-3xl font-bold text-slate-900">{business.name}</h1>
              <p className="mt-2 max-w-2xl text-slate-600">{business.description}</p>
              <p className="mt-2 text-sm text-slate-500">{business.contact_email} {business.contact_phone ? `· ${business.contact_phone}` : ""}</p>
            </div>
          </div>
        </section>
        <section className="mt-8">
          <CatalogBrowser business={business} products={products} liveSessions={liveSessions} />
        </section>
      </main>
      <AssistantWidget businessSlug={business.slug} businessName={business.name} />
    </div>
  );
}

export const instant = false
