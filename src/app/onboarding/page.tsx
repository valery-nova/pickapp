import { redirect } from "next/navigation";
import { BusinessForm } from "@/components/business-form";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { getBusinessForUser } from "@/lib/data";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "entrepreneur") redirect("/store/casa-nova");
  const business = await getBusinessForUser(user);
  if (business) redirect("/dashboard");
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Configura tu negocio</h1>
          <p className="mt-2 text-sm text-slate-600">Esta información aparecerá en tu tienda pública y en el asistente IA.</p>
          <div className="mt-6"><BusinessForm /></div>
        </div>
      </main>
    </div>
  );
}

export const instant = false
