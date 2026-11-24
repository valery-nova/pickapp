import { apiError, json } from "@/lib/api";
import { getBusinessBySlug, getStoreCatalog, listPublicLiveSessions } from "@/lib/data";
import type { CatalogQuery } from "@/lib/data/contracts";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    const business = await getBusinessBySlug(slug);
    if (!business) return json({ error: "BUSINESS_NOT_FOUND" }, 404);
    const sp = new URL(request.url).searchParams;
    const query: CatalogQuery = {
      q: sp.get("q") ?? undefined,
      category: sp.get("category") ?? undefined,
      inStock: sp.get("inStock") === "1",
      featured: sp.get("featured") === "1",
    };
    const [products, liveSessions] = await Promise.all([getStoreCatalog(business.id, query), listPublicLiveSessions(business.id)]);
    return json({ business, products, live_sessions: liveSessions });
  } catch (error) {
    return apiError(error);
  }
}
