"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { LiveCommentDTO, LiveSessionDTO } from "@/lib/data/contracts";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={filled ? "#ff4757" : "none"} stroke={filled ? "#ff4757" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function LiveShopping({ session, storeSlug, businessName }: { session: LiveSessionDTO; storeSlug: string; businessName: string }) {
  const featuredProducts = session.featured_products;
  const [comments, setComments] = useState<LiveCommentDTO[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; sub?: string } | null>(null);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [commentProductId, setCommentProductId] = useState("");
  const [saved, setSaved] = useState(false);
  const safeFeaturedIndex = featuredProducts.length === 0 ? 0 : Math.min(featuredIndex, featuredProducts.length - 1);
  const featured = featuredProducts[safeFeaturedIndex] ?? null;

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/live/sessions/${session.id}/comments`);
      const data = await response.json();
      if (response.ok) setComments(data.comments ?? []);
    } catch {
      // polling is best-effort
    }
  }, [session.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("pickapp-live-saved");
        const ids = raw ? JSON.parse(raw) : [];
        setSaved(Array.isArray(ids) && ids.includes(session.id));
      } catch {
        setSaved(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session.id]);

  function showToast(title: string, sub?: string) {
    setToast({ title, sub });
    window.setTimeout(() => setToast(null), 2800);
  }

  async function share() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(window.location.href);
      showToast("Enlace copiado", "Comparte este Live");
    } catch {
      showToast("No se pudo copiar", window.location.href);
    }
  }

  function toggleSaved() {
    const next = !saved;
    setSaved(next);
    try {
      const key = "pickapp-live-saved";
      const raw = window.localStorage.getItem(key);
      const ids = raw ? JSON.parse(raw) : [];
      const set = new Set(Array.isArray(ids) ? ids : []);
      if (next) set.add(session.id); else set.delete(session.id);
      window.localStorage.setItem(key, JSON.stringify([...set]));
    } catch {
      // local favorites are best-effort
    }
    showToast(next ? "Guardado en favoritos" : "Quitado de favoritos", "Solo en este dispositivo");
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/live/sessions/${session.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customer_name: name || "Cliente", message, product_id: commentProductId || null }),
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

  const background = featured?.image_url ?? "/brand/product-placeholder.svg";
  const stock = featured?.available_quantity ?? 0;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={background} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[430px] bg-gradient-to-t from-[#12040a] via-[#12040a]/90 to-transparent" />

      <header className="absolute inset-x-0 top-0 z-20 px-4 pt-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/pickapp-logo.jpeg" alt="PickApp" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-base font-extrabold tracking-wide">PICKAPP</span>
          </Link>
          <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${session.status === "live" ? "bg-red-500" : "bg-white/20"}`}>
            {session.status === "live" ? "LIVE" : session.status.toUpperCase()}
          </span>
        </div>
        <nav className="mt-4 flex gap-5 text-sm font-semibold text-white/60">
          <span>Para ti</span>
          <span>Siguiendo</span>
          <span className="text-white">LIVE</span>
        </nav>
      </header>

      <aside className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-5">
        <button type="button" onClick={() => setLiked((value) => !value)} aria-label="Me gusta" className="flex flex-col items-center gap-1">
          <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur ${liked ? "text-[#ff4757]" : "text-white"}`}>
            <HeartIcon filled={liked} />
          </span>
          <span className="text-[11px] font-semibold">{liked ? "1" : "0"}</span>
        </button>
        <button type="button" onClick={() => setCommentsOpen(true)} aria-label="Comentarios" className="flex flex-col items-center gap-1">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur"><ChatIcon /></span>
          <span className="text-[11px] font-semibold">{comments.length}</span>
        </button>
        <button type="button" onClick={share} aria-label="Compartir" className="flex flex-col items-center gap-1">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur"><ShareIcon /></span>
          <span className="text-[11px] font-semibold">Compartir</span>
        </button>
        <button type="button" onClick={toggleSaved} aria-label="Guardar" className="flex flex-col items-center gap-1">
          <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur ${saved ? "text-red-400" : "text-white"}`}><SaveIcon /></span>
          <span className="text-[11px] font-semibold">{saved ? "Guardado" : "Guardar"}</span>
        </button>
      </aside>

      <section className="absolute bottom-40 left-4 right-24 z-20">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold">{businessName.toLowerCase().replace(/\s+/g, ".")}</h1>
          <button type="button" onClick={() => setFollowing((value) => !value)} className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold ${following ? "border-transparent bg-white/20 text-white" : "border-red-400/40 bg-red-500/15 text-red-400"}`}>
            {following ? "Siguiendo" : "Seguir"}
          </button>
        </div>
        <h2 className="mt-2 text-lg font-bold leading-tight">{session.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-white/85">{session.description || "Live de lanzamientos con stock real y pedidos con reserva automática."}</p>
      </section>

      {featured ? (
        <div className="absolute bottom-24 left-4 right-24 z-30 flex items-center gap-3 rounded-[20px] border border-white/15 bg-[#191919]/90 p-3 shadow-2xl backdrop-blur-xl">
          {featuredProducts.length > 1 ? (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setFeaturedIndex((value) => (value - 1 + featuredProducts.length) % featuredProducts.length)} aria-label="Producto anterior" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg leading-none text-white">‹</button>
              <button type="button" onClick={() => setFeaturedIndex((value) => (value + 1) % featuredProducts.length)} aria-label="Producto siguiente" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg leading-none text-white">›</button>
            </div>
          ) : null}
          <Link href={`/store/${storeSlug}/product/${featured.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featured.image_url ?? "/brand/product-placeholder.svg"} alt={featured.name} className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-400 to-red-300 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{featured.name}</p>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-lg font-extrabold">{featured.price} {featured.currency}</p>
                <p className="flex items-center gap-1 text-[11px] text-white/70"><span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {stock > 0 ? `Disponible: ${stock}` : "Agotado"}</p>
              </div>
            </div>
          </Link>
          {featuredProducts.length > 1 ? (
            <div className="flex flex-col items-center gap-1">
              {featuredProducts.map((product, index) => (
                <button key={product.id} type="button" onClick={() => setFeaturedIndex(index)} aria-label={`Ver ${product.name}`} className={`h-1.5 rounded-full ${index === safeFeaturedIndex ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />
              ))}
            </div>
          ) : null}
          <Link href={`/store/${storeSlug}/product/${featured.id}`} className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-black">Reservar</Link>
        </div>
      ) : null}

      <nav className="absolute inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-white/10 bg-black/95 text-[11px] font-semibold text-white/50">
        <Link href="/" className="flex flex-col items-center gap-1 text-white"><NavIcon><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></NavIcon>Inicio</Link>
        <Link href="/stores" className="flex flex-col items-center gap-1"><NavIcon><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /></NavIcon>Tiendas</Link>
        <Link href={`/store/${storeSlug}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-2xl font-light text-black">+</Link>
        <Link href="/dashboard" className="flex flex-col items-center gap-1"><NavIcon><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></NavIcon>Caja</Link>
        <Link href="/login" className="flex flex-col items-center gap-1"><NavIcon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></NavIcon>Perfil</Link>
      </nav>

      {commentsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setCommentsOpen(false)}>
          <div className="h-[72vh] w-full rounded-t-3xl border-t border-white/10 bg-[#101010] p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">Comentarios · {comments.length}</h3>
              <button type="button" onClick={() => setCommentsOpen(false)} className="rounded-full bg-white/10 px-3 py-1 text-sm">Cerrar</button>
            </div>
            <div className="mb-3 max-h-[45vh] space-y-3 overflow-auto">
              {comments.length === 0 ? <p className="text-sm text-white/50">Sé la primera persona en comentar.</p> : null}
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl bg-white/5 p-3 text-sm">
                  <p className="font-semibold">{comment.customer_name} {comment.product_name ? <span className="font-normal text-red-400">· {comment.product_name}</span> : null}</p>
                  <p className="text-white/75">{comment.message}</p>
                </div>
              ))}
            </div>
            <form onSubmit={send} className="space-y-2 border-t border-white/10 pt-3">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm outline-none" />
              <select value={commentProductId} onChange={(event) => setCommentProductId(event.target.value)} className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm outline-none">
                <option value="" className="bg-[#101010]">Comentario general</option>
                {featuredProducts.map((product) => <option key={product.id} value={product.id} className="bg-[#101010]">{product.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escribe un comentario…" className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none" />
                <button disabled={busy} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-60">Enviar</button>
              </div>
              {error ? <p className="text-xs text-red-400">{error}</p> : null}
            </form>
          </div>
        </div>
      ) : null}

      {toast ? <div className="fixed left-1/2 top-16 z-[60] w-[85%] max-w-sm -translate-x-1/2 rounded-2xl border border-green-500 bg-[#1a1a1a] px-4 py-3 text-center shadow-2xl"><p className="text-sm font-semibold">{toast.title}</p>{toast.sub ? <p className="mt-1 break-all text-xs text-white/60">{toast.sub}</p> : null}</div> : null}
    </div>
  );
}
