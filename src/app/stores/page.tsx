import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { listBusinesses } from "@/lib/data";

export default async function StoresPage() {
  const businesses = await listBusinesses();
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold text-slate-900">Tiendas</h1>
        <p className="mt-2 text-slate-600">Descubre negocios publicados en PICKAPP.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((business) => (
            <Link key={business.id} href={`/store/${business.slug}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={business.cover_url ?? business.logo_url ?? "/brand/product-placeholder.svg"} alt={business.name} className="h-40 w-full object-cover" />
              <div className="p-4">
                <h2 className="font-semibold text-slate-900">{business.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{business.description}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-red-600">{business.category || "Tienda"}</p>
              </div>
            </Link>
          ))}
        </div>
        {businesses.length === 0 ? <p className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-slate-500">No hay tiendas publicadas todavía.</p> : null}
      </main>
    </div>
  );
}

export const instant = false
