"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { InventoryDTO, ProductDTO } from "@/lib/data/contracts";
import { formatMoney } from "@/lib/format";

type Draft = {
  name: string;
  description: string;
  category: string;
  tags: string;
  price: string;
  stock: string;
  image_url: string;
  ai_generated: boolean;
};

const empty: Draft = { name: "", description: "", category: "", tags: "", price: "", stock: "0", image_url: "", ai_generated: false };

export function ProductStudio({ products, inventory }: { products: ProductDTO[]; inventory: InventoryDTO[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"idle" | "ai" | "save" | "adjust">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof Draft) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((current) => ({ ...current, [key]: event.target.value }));
  }

  async function generateAi() {
    if (!file && !draft.description.trim()) {
      setError("Sube una foto o escribe una descripción para generar la ficha.");
      return;
    }
    setBusy("ai");
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      form.set("description", draft.description);
      const response = await fetch("/api/products/draft", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo generar la ficha");
      const ai = data.draft;
      setDraft((current) => ({
        ...current,
        name: ai.name ?? current.name,
        description: ai.description ?? current.description,
        category: ai.category ?? current.category,
        tags: (ai.tags ?? []).join(", "),
        price: ai.suggested_price ? String(ai.suggested_price) : current.price,
        ai_generated: true,
        image_url: current.image_url,
      }));
      setMessage(`Ficha generada por ${ai.provider}${ai.model ? ` (${ai.model})` : ""}. Revisa antes de publicar.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de IA");
    } finally {
      setBusy("idle");
    }
  }

  async function saveProduct() {
    if (!draft.name.trim() || !draft.price) {
      setError("Nombre y precio son obligatorios.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      let imageUrl = draft.image_url;
      if (file && !imageUrl) {
        const form = new FormData();
        form.set("file", file);
        const upload = await fetch("/api/upload", { method: "POST", body: form });
        const uploaded = await upload.json();
        if (!upload.ok) throw new Error(uploaded.error ?? "No se pudo subir la imagen");
        imageUrl = uploaded.url;
      }
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          category: draft.category,
          tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          price: Number(draft.price),
          status: "published",
          featured: false,
          ai_generated: draft.ai_generated,
          image_url: imageUrl || undefined,
          initial_stock: Number(draft.stock || 0),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo crear el producto");
      setDraft(empty);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Producto publicado.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy("idle");
    }
  }

  async function setStatus(product: ProductDTO, status: "draft" | "published" | "archived") {
    setBusy("save");
    setError(null);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo actualizar");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setBusy("idle");
    }
  }

  async function adjust(productId: string, delta: number) {
    setBusy("adjust");
    setError(null);
    try {
      const response = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_id: productId, delta, reason: "ajuste manual" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo ajustar inventario");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de inventario");
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Nuevo producto con IA</h2>
        <div className="mt-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="w-full text-sm" />
          <textarea value={draft.description} onChange={set("description")} rows={3} placeholder="Descripción opcional para guiar a la IA" className="w-full rounded-xl border border-slate-300 px-3 py-2" />
          <div className="flex gap-2">
            <button type="button" onClick={generateAi} disabled={busy !== "idle"} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy === "ai" ? "Generando…" : "Generar ficha IA"}
            </button>
            <button type="button" onClick={saveProduct} disabled={busy !== "idle"} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy === "save" ? "Guardando…" : "Publicar"}
            </button>
          </div>
          {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={draft.name} onChange={set("name")} placeholder="Nombre" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input value={draft.category} onChange={set("category")} placeholder="Categoría" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input value={draft.price} onChange={set("price")} inputMode="decimal" placeholder="Precio" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input value={draft.stock} onChange={set("stock")} inputMode="numeric" placeholder="Stock inicial" className="rounded-xl border border-slate-300 px-3 py-2" />
          </div>
          <input value={draft.tags} onChange={set("tags")} placeholder="Etiquetas separadas por coma" className="w-full rounded-xl border border-slate-300 px-3 py-2" />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Productos e inventario</h2>
        <div className="mt-4 space-y-3">
          {products.length === 0 ? <p className="text-sm text-slate-500">Aún no hay productos.</p> : null}
          {products.map((product) => {
            const stock = inventory.find((item) => item.product_id === product.id);
            return (
              <article key={product.id} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{product.name}</p>
                    <p className="text-sm text-slate-500">{formatMoney(product.price, product.currency)} · {stock ? `${stock.available_quantity} disponibles` : "sin stock"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${product.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{product.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.status !== "published" ? <button onClick={() => setStatus(product, "published")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Publicar</button> : null}
                  {product.status !== "draft" ? <button onClick={() => setStatus(product, "draft")} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">Borrador</button> : null}
                  <button onClick={() => adjust(product.id, 1)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">+1 stock</button>
                  <button onClick={() => adjust(product.id, -1)} className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800">-1 stock</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
