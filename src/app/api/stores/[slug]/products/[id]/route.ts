import { apiError, json } from "@/lib/api";
import { getBusinessBySlug, getStoreProduct } from "@/lib/data";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { slug, id } = await ctx.params;
    const business = await getBusinessBySlug(slug);
    if (!business) return json({ error: "BUSINESS_NOT_FOUND" }, 404);
    const product = await getStoreProduct(business.id, id);
    if (!product) return json({ error: "PRODUCT_NOT_FOUND" }, 404);
    return json({ business, product });
  } catch (error) {
    return apiError(error);
  }
}
