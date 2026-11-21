import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">Social commerce + IA + n8n</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Tu negocio vende. PICKAPP se encarga del resto.</h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              Sube una foto, genera la ficha comercial, publica tu catálogo, atiende con un asistente que usa stock real y convierte conversaciones en pedidos con inventario reservado.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700">Crear mi tienda</Link>
              <Link href="/stores" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50">Explorar tiendas</Link>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/pickapp-logo.jpeg" alt="PICKAPP" className="mx-auto h-28 w-28 rounded-full object-cover" />
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <p><strong className="text-slate-900">Foto → ficha comercial.</strong> La IA propone nombre, descripción, categoría y texto promocional; tú revisas y publicas.</p>
              <p><strong className="text-slate-900">Stock real, siempre.</strong> El asistente y los pedidos consultan inventario transaccional; no hay ventas de unidades inexistentes.</p>
              <p><strong className="text-slate-900">Pedidos sin fricción.</strong> Idempotencia, reservas temporales y estados controlados para el MVP sin pagos reales.</p>
            </div>
          </div>
        </section>
        <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Tienda pública", "Catálogo, búsqueda, filtros y experiencia móvil."],
            ["Asistente IA", "Responde con catálogo e inventario reales."],
            ["LIVE", "Sesiones con productos destacados y comentarios."],
            ["Dashboard", "Ventas confirmadas vs pendientes, alertas y recomendaciones."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export const instant = false
