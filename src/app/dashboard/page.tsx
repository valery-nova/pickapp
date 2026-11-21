import { redirect } from "next/navigation";
import { LiveManager } from "@/components/live-manager";
import { OrdersManager } from "@/components/orders-manager";
import { ProductStudio } from "@/components/product-studio";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { getAnalyticsReport, getBusinessForUser, getDashboardMetrics, getInventory, listBusinessProducts, listLiveSessions, listOrders } from "@/lib/data";
import { formatMoney } from "@/lib/format";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const business = await getBusinessForUser(user);
  if (!business) redirect("/onboarding");
  const [metrics, products, inventory, orders, liveSessions, report] = await Promise.all([
    getDashboardMetrics(user),
    listBusinessProducts(user),
    getInventory(user),
    listOrders(user),
    listLiveSessions(user),
    getAnalyticsReport(user, 30),
  ]);
  const published = products.filter((product) => product.status === "published");

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-red-600">Panel de emprendedora</p>
            <h1 className="text-3xl font-bold text-slate-900">{business.name}</h1>
            <p className="mt-1 text-slate-600">Tienda: <a className="font-medium text-red-700" href={`/store/${business.slug}`}>/store/{business.slug}</a></p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <p>Confirmado: <strong className="text-emerald-700">{formatMoney(metrics.confirmed_revenue, metrics.currency)}</strong></p>
            <p>Pendiente/no pagado: <strong className="text-amber-700">{formatMoney(metrics.pending_revenue, metrics.currency)}</strong></p>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Pedidos", String(metrics.orders_total)],
            ["Pendientes", String(metrics.orders_pending)],
            ["Productos publicados", String(metrics.products_published)],
            ["Stock bajo", String(metrics.low_stock_count + metrics.out_of_stock_count)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        {metrics.low_stock_count + metrics.out_of_stock_count > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Tienes {metrics.low_stock_count} productos con stock bajo y {metrics.out_of_stock_count} agotados. Revisa inventario antes de promocionar.
          </div>
        ) : null}

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-slate-900">Productos e inventario</h2>
          <div className="mt-3"><ProductStudio products={products} inventory={inventory} /></div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pedidos</h2>
            <div className="mt-3"><OrdersManager orders={orders} /></div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Sesiones LIVE</h2>
            <div className="mt-3"><LiveManager sessions={liveSessions} products={published} /></div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">Analista comercial IA</h2>
          <p className="mt-2 text-sm text-slate-600">{report.narrative}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {report.recommendations.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </main>
    </div>
  );
}

export const instant = false
