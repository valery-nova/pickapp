"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BusinessForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", description: "", category: "", contact_email: "", contact_phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo crear el negocio");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Nombre del negocio
        <input required minLength={2} value={form.name} onChange={set("name")} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Descripción
        <textarea value={form.description} onChange={set("description")} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Categoría
          <input value={form.category} onChange={set("category")} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Email de contacto
          <input type="email" value={form.contact_email} onChange={set("contact_email")} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Teléfono / WhatsApp
        <input value={form.contact_phone} onChange={set("contact_phone")} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
      </label>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60">
        {loading ? "Creando…" : "Crear tienda"}
      </button>
    </form>
  );
}
