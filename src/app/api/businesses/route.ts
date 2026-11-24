import { apiError, json, parseJson, requireApiUser } from "@/lib/api";
import { createBusiness, listBusinesses } from "@/lib/data";
import { businessSchema } from "@/lib/validation";

export async function GET() {
  try {
    return json({ businesses: await listBusinesses() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const input = await parseJson(request, businessSchema);
    return json({ business: await createBusiness(user, input) }, 201);
  } catch (error) {
    return apiError(error);
  }
}
