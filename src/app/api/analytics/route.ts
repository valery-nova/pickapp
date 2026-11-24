import { apiError, json, requireApiUser, requireBusiness } from "@/lib/api";
import { getAnalyticsReport } from "@/lib/data";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    await requireBusiness(user);
    const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
    return json({ report: await getAnalyticsReport(user, Number.isFinite(days) ? days : 30) });
  } catch (error) {
    return apiError(error);
  }
}
