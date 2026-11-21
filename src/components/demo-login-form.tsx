"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DemoLoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<"entrepreneur" | "customer">("entrepreneur");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo iniciar sesión");
      if (role === "entrepreneur") {
        router.push("/onboarding");
      } else {
        const stores = await fetch("/api/businesses").then((res) => res.json());
        const first = stores.businesses?.[0]?.slug;
        router.push(first ? `/store/${first}` : "/stores");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        {(["entrepreneur", "customer"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRole(item)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${role === item ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}
          >
            {item === "entrepreneur" ? "Emprendedora" : "Cliente"}
          </button>
        ))}
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Nombre
        <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
      </label>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60">
        {loading ? "Entrando…" : "Continuar"}
      </button>
      <p className="text-xs text-slate-500">Modo demo: no se requiere contraseña. En producción se usa Clerk.</p>
    </form>
  );
}
