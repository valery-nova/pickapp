import { notFound } from "next/navigation";
import { AssistantWidget } from "@/components/assistant-widget";
import { OrderForm } from "@/components/order-form";
import { SiteHeader } from "@/components/site-header";
import { getBusinessBySlug, getStoreProduct } from "@/lib/data";
import { formatMoney } from "@/lib/format";

export default async function ProductPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const product = await getStoreProduct(business.id, id);
  if (!product) notFound();
  const image = product.images[0]?.url ?? product.image_url ?? "/brand/product-placeholder.svg";

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <a href={`/store/${business.slug}`} className="text-sm font-medium text-red-700">← Volver a {business.name}</a>
        <div className="mt-4 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={product.name} className="aspect-[4/3] w-full object-cover" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">{product.category || "Producto"}</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">{product.name}</h1>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{formatMoney(product.price, product.currency)}</p>
              <p className="mt-1 text-sm text-slate-500">{product.available_quantity && product.available_quantity > 0 ? `${product.available_quantity} disponibles` : "Agotado"}{product.ai_generated ? " · ficha con IA" : ""}</p>
            </div>
            <p className="whitespace-pre-line text-slate-700">{product.description}</p>
            {product.tags.length ? <div className="flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{tag}</span>)}</div> : null}
            {product.variants.length ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">Variantes</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">{product.variants.map((variant) => <li key={variant.id}>{variant.name}{variant.price_override ? ` · ${formatMoney(variant.price_override, product.currency)}` : ""}</li>)}</ul>
              </div>
            ) : null}
            <OrderForm businessSlug={business.slug} productId={product.id} productName={product.name} price={product.price} currency={product.currency} available={product.available_quantity} />
          </div>
        </div>
      </main>
      <AssistantWidget businessSlug={business.slug} businessName={business.name} />
    </div>
  );
}

export const instant = false
