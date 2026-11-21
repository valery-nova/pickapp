"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BusinessDTO, LiveSessionDTO, ProductDTO } from "@/lib/data/contracts";
import { formatMoney } from "@/lib/format";

export function CatalogBrowser({ business, products, liveSessions }: { business: BusinessDTO; products: ProductDTO[]; liveSessions: LiveSessionDTO[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))], [products]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === "Todas" || product.category === category;
      const haystack = [product.name, product.description, product.category, ...product.tags].join(" ").toLowerCase();
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [products, query, category]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar productos…" className="flex-1 rounded-xl border border-slate-300 px-3 py-2" />
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      {liveSessions.length ? (
        <div className="mt-4 flex gap-2 overflow-auto pb-2">
          {liveSessions.map((session) => (
            <Link key={session.id} href={`/live/${session.id}`} className="shrink-0 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white">
              {session.status === "live" ? "EN VIVO" : "Programado"}: {session.title}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => (
          <Link key={product.id} href={`/store/${business.slug}/product/${product.id}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="aspect-[4/3] bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.image_url ?? "/brand/product-placeholder.svg"} alt={product.name} className="h-full w-full object-cover" />
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">{product.category || "Producto"}</p>
              <h3 className="mt-1 font-semibold text-slate-900 group-hover:text-red-700">{product.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{product.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-semibold text-slate-900">{formatMoney(product.price, product.currency)}</span>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${product.available_quantity && product.available_quantity > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {product.available_quantity && product.available_quantity > 0 ? `${product.available_quantity} disp.` : "Agotado"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length === 0 ? <p className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">No encontramos productos con ese filtro.</p> : null}
    </div>
  );
}
