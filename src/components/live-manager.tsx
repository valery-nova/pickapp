"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LiveSessionDTO, ProductDTO } from "@/lib/data/contracts";

export function LiveManager({ sessions, products }: { sessions: LiveSessionDTO[]; products: ProductDTO[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(productId: string) {
    setSelected((current) => (current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]));
  }

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/live/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, featured_product_ids: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo crear la sesión");
      setTitle("");
      setDescription("");
      setSelected([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(session: LiveSessionDTO, status: "scheduled" | "live" | "ended") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/live/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo actualizar");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Crear sesión LIVE</h2>
        <div className="mt-4 space-y-3">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="w-full rounded-xl border border-slate-300 px-3 py-2" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Descripción" className="w-full rounded-xl border border-slate-300 px-3 py-2" />
          <div className="max-h-48 space-y-2 overflow-auto rounded-xl border border-slate-200 p-3">
            {products.length === 0 ? <p className="text-sm text-slate-500">Publica productos primero.</p> : null}
            {products.map((product) => (
              <label key={product.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />
                {product.name}
              </label>
            ))}
          </div>
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button onClick={create} disabled={busy} className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-60">Crear sesión</button>
        </div>
      </section>
      <section className="space-y-3">
        {sessions.length === 0 ? <p className="text-sm text-slate-500">No hay sesiones LIVE.</p> : null}
        {sessions.map((session) => (
          <article key={session.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{session.title}</p>
                <p className="text-sm text-slate-500">{session.status} · {session.featured_products.length} productos destacados</p>
              </div>
              <Link href={`/live/${session.id}`} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">Abrir sala</Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {session.status === "scheduled" ? <button disabled={busy} onClick={() => setStatus(session, "live")} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">Iniciar</button> : null}
              {session.status === "live" ? <button disabled={busy} onClick={() => setStatus(session, "ended")} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">Finalizar</button> : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
