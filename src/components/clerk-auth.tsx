"use client";

import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ClerkAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/onboarding");
      router.refresh();
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        {(["signin", "signup"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === item ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}
          >
            {item === "signin" ? "Entrar" : "Crear cuenta"}
          </button>
        ))}
      </div>
      {mode === "signin" ? <SignIn /> : <SignUp />}
      <p className="text-xs text-slate-500">Si ya tienes negocio, PICKAPP te llevará a tu panel; si no, a crear tu tienda.</p>
    </div>
  );
}
