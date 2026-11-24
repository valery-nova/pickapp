"use client";

import { useRef, useState } from "react";
import { formatMoney } from "@/lib/format";

export function OrderForm({ businessSlug, productId, productName, price, currency, available }: { businessSlug: string; productId: string; productName: string; price: number; currency: string; available: number | null }) {
  const idempotencyKey = useRef<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", quantity: "1", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{ id: string; status: string; total: number } | null>(null);

  function set(key: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const key = idempotencyKey.current ?? crypto.randomUUID();
      idempotencyKey.current = key;
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          business_slug: businessSlug,
          customer: { name: form.name, email: form.email || undefined, phone: form.phone || undefined },
          items: [{ product_id: productId, quantity: Number(form.quantity) }],
          idempotency_key: key,
          notes: form.notes || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo crear el pedido");
      setOrder({ id: data.order.id, status: data.order.status, total: data.order.total });
      idempotencyKey.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al pedir");
    } finally {
      setLoading(false);
    }
  }

  if (order) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <p className="font-semibold">Pedido creado: {order.id.slice(0, 8)}</p>
        <p className="text-sm">Estado: {order.status}. Total: {formatMoney(order.total)}. La emprendedora fue notificada; no se procesó ningún pago real.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Pedir {productName}</h3>
        <p className="text-sm text-slate-500">{formatMoney(price, currency)} {available !== null ? `· ${available} disp.` : ""}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required value={form.name} onChange={set("name")} placeholder="Tu nombre" className="rounded-xl border border-slate-300 px-3 py-2" />
        <input type="email" value={form.email} onChange={set("email")} placeholder="Email (opcional)" className="rounded-xl border border-slate-300 px-3 py-2" />
        <input value={form.phone} onChange={set("phone")} placeholder="Teléfono / WhatsApp" className="rounded-xl border border-slate-300 px-3 py-2" />
        <input required type="number" min={1} max={available ?? undefined} value={form.quantity} onChange={set("quantity")} placeholder="Cantidad" className="rounded-xl border border-slate-300 px-3 py-2" />
      </div>
      <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Nota para la emprendedora" className="w-full rounded-xl border border-slate-300 px-3 py-2" />
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
        {loading ? "Validando stock…" : "Crear pedido"}
      </button>
      <p className="text-xs text-slate-500">MVP sin pagos reales: el pedido queda en pending/awaiting_payment hasta que la emprendedora lo confirme.</p>
    </form>
  );
}
