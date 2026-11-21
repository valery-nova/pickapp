import { apiError, json, requireApiUser, requireBusiness } from "@/lib/api";
import { getInventory } from "@/lib/data";

export async function GET() {
  try {
    const user = await requireApiUser();
    await requireBusiness(user);
    return json({ inventory: await getInventory(user) });
  } catch (error) {
    return apiError(error);
  }
}
