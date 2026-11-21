import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { env } from "@/lib/env";

export async function SiteHeader() {
  const user = await getSessionUser();
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/pickapp-logo.jpeg" alt="PICKAPP" className="h-10 w-10 rounded-full object-cover" />
          <span className="text-lg font-semibold tracking-tight text-slate-900">PICKAPP</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Link href="/stores" className="rounded-full px-3 py-2 hover:bg-slate-100">Tiendas</Link>
          {user ? (
            <>
              <Link href="/dashboard" className="rounded-full px-3 py-2 hover:bg-slate-100">Panel</Link>
              <span className="hidden rounded-full bg-red-50 px-3 py-2 text-red-700 sm:inline">{user.full_name}</span>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-slate-900 px-4 py-2 text-white hover:bg-slate-700">Entrar</Link>
          )}
        </nav>
      </div>
      {env.dataMode === "demo" ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
          Modo demo: datos en memoria. Configura Supabase/Clerk para producción.
        </div>
      ) : null}
    </header>
  );
}
