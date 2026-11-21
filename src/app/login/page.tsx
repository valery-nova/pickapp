import { DemoLoginForm } from "@/components/demo-login-form";
import { SiteHeader } from "@/components/site-header";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Entra a PICKAPP</h1>
          <p className="mt-2 text-sm text-slate-600">Elige si vas a vender o comprar. En modo demo no hay contraseña.</p>
          <div className="mt-6"><DemoLoginForm /></div>
        </div>
      </main>
    </div>
  );
}

export const instant = false
