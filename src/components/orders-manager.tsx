"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderStatus } from "@/lib/types";
import type { OrderDTO } from "@/lib/data/contracts";
import { formatDate, formatMoney } from "@/lib/format";

const nextActions: Partial<Record<OrderStatus, Array<{ status: OrderStatus; label: string }>>> = {
  pending: [
    { status: "awaiting_payment", label: "Esperar pago" },
    { status: "confirmed", label: "Confirmar" },
    { status: "cancelled", label: "Cancelar" },
  ],
  awaiting_payment: [
    { status: "confirmed", label: "Confirmar" },
    { status: "cancelled", label: "Cancelar" },
  ],
  confirmed: [
    { status: "processing", label: "Procesar" },
    { status: "cancelled", label: "Cancelar" },
  ],
  processing: [
    { status: "shipped", label: "Enviar" },
    { status: "cancelled", label: "Cancelar" },
  ],
  shipped: [{ status: "delivered", label: "Entregado" }],
};

export function OrdersManager({ orders }: { orders: OrderDTO[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function transition(order: OrderDTO, status: OrderStatus) {
    setBusy(order.id);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo actualizar el pedido");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {orders.length === 0 ? <p className="text-sm text-slate-500">No hay pedidos todavía.</p> : null}
      {orders.map((order) => (
        <article key={order.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">Pedido {order.id.slice(0, 8)}</p>
              <p className="text-sm text-slate-500">{order.customer_name ?? "Cliente"} · {formatDate(order.created_at)}</p>
              <p className="mt-2 text-sm text-slate-600">{order.items.map((item) => `${item.quantity}x ${item.product_name}`).join(", ")}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">{formatMoney(order.total, order.currency)}</p>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{order.status}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(nextActions[order.status] ?? []).map((action) => (
              <button key={action.status} disabled={busy === order.id} onClick={() => transition(order, action.status)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                {action.label}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
