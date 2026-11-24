import { apiError, json } from "@/lib/api";
import { getBusinessBySlug, listPublicLiveSessions } from "@/lib/data";

export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get("business");
    if (!slug) return json({ error: "BUSINESS_REQUIRED" }, 400);
    const business = await getBusinessBySlug(slug);
    if (!business) return json({ error: "BUSINESS_NOT_FOUND" }, 404);
    return json({ sessions: await listPublicLiveSessions(business.id) });
  } catch (error) {
    return apiError(error);
  }
}
