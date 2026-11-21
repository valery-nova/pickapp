import { apiError, json, parseJson, requireApiUser, requireBusiness } from "@/lib/api";
import { adjustInventory } from "@/lib/data";
import { inventoryAdjustSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    await requireBusiness(user);
    const input = await parseJson(request, inventoryAdjustSchema);
    return json({ inventory: await adjustInventory(user, input.product_id, input.delta, input.reason) });
  } catch (error) {
    return apiError(error);
  }
}
