"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LiveCommentDTO, LiveSessionDTO, ProductDTO } from "@/lib/data/contracts";
import { formatDate } from "@/lib/format";

export function LiveRoom({ session, storeSlug }: { session: LiveSessionDTO; storeSlug: string }) {
  const [comments, setComments] = useState<LiveCommentDTO[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [productId, setProductId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch(`/api/live/sessions/${session.id}/comments`);
      const data = await response.json();
      if (response.ok) setComments(data.comments ?? []);
    } catch {
      // keep polling silently
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [session.id]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/live/sessions/${session.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customer_name: name || "Cliente", message, product_id: productId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo comentar");
      setMessage("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-500" /> {session.status === "live" ? "EN VIVO" : session.status}
          </div>
          <h1 className="mt-2 text-2xl font-bold">{session.title}</h1>
          <p className="mt-2 text-slate-300">{session.description}</p>
          <p className="mt-2 text-xs text-slate-500">{formatDate(session.started_at ?? session.created_at)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Productos destacados</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {session.featured_products.length === 0 ? <p className="text-sm text-slate-500">Sin productos destacados.</p> : null}
            {session.featured_products.map((product: ProductDTO) => (
              <Link key={product.id} href={`/store/${storeSlug}/product/${product.id}`} className="flex gap-3 rounded-2xl border border-slate-200 p-3 hover:border-red-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.image_url ?? "/brand/product-placeholder.svg"} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
                <div>
                  <p className="font-semibold text-slate-900">{product.name}</p>
                  <p className="text-sm text-slate-500">{product.price} {product.currency}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Comentarios</h2>
        <div className="mt-3 max-h-[420px] space-y-3 overflow-auto">
          {comments.length === 0 ? <p className="text-sm text-slate-500">Sé la primera persona en comentar.</p> : null}
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">{comment.customer_name} {comment.product_name ? <span className="font-normal text-red-600">· {comment.product_name}</span> : null}</p>
              <p className="text-slate-700">{comment.message}</p>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <select value={productId} onChange={(event) => setProductId(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pregunta general</option>
            {session.featured_products.map((product: ProductDTO) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escribe un comentario…" className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <button disabled={busy} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Enviar</button>
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </form>
      </section>
    </div>
  );
}
