"use client";

import Link from "next/link";
import { useState } from "react";

type Message = { role: "customer" | "assistant"; content: string; products?: string[] };

export function AssistantWidget({ businessSlug, businessName }: { businessSlug: string; businessName: string }) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [customerName, setCustomerName] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: `Hola, soy el asistente de ${businessName}. Pregúntame por productos, precios o disponibilidad.` },
  ]);
  const [busy, setBusy] = useState(false);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((current) => [...current, { role: "customer", content: message }]);
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ business_slug: businessSlug, conversation_id: conversationId, customer_name: customerName || undefined, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo responder");
      setConversationId(data.conversation_id);
      setMessages((current) => [...current, { role: "assistant", content: data.reply, products: data.referenced_product_ids ?? [] }]);
    } catch (err) {
      setMessages((current) => [...current, { role: "assistant", content: err instanceof Error ? err.message : "Error del asistente" }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 rounded-full bg-red-600 px-5 py-3 font-semibold text-white shadow-lg hover:bg-red-700">
        Asistente IA
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[520px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <div>
          <p className="font-semibold">Asistente PICKAPP</p>
          <p className="text-xs text-slate-300">{businessName}</p>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-full px-2 py-1 text-sm hover:bg-white/10">✕</button>
      </div>
      <div className="flex-1 space-y-3 overflow-auto p-3">
        {messages.map((message, index) => (
          <div key={index} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.role === "customer" ? "ml-auto bg-red-600 text-white" : "bg-slate-100 text-slate-800"}`}>
            <p>{message.content}</p>
            {message.products?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {message.products.slice(0, 4).map((productId) => (
                  <Link key={productId} href={`/store/${businessSlug}/product/${productId}`} className="rounded-full bg-white/80 px-2 py-1 text-xs text-slate-700">
                    Ver producto
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {busy ? <p className="text-xs text-slate-500">Escribiendo…</p> : null}
      </div>
      <div className="border-t border-slate-200 p-3">
        <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Tu nombre (opcional)" className="mb-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} placeholder="Pregunta por un producto…" className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <button onClick={send} disabled={busy} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Enviar</button>
        </div>
      </div>
    </div>
  );
}
