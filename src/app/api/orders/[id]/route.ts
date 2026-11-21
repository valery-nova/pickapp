import { apiError, json, parseJson, requireApiUser, requireBusiness } from "@/lib/api";
import { updateOrderStatus } from "@/lib/data";
import { orderStatusSchema } from "@/lib/validation";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const patchSchema = z.object({ status: orderStatusSchema });

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    await requireBusiness(user);
    const { id } = await ctx.params;
    const input = await parseJson(request, patchSchema);
    return json({ order: await updateOrderStatus(user, id, input.status) });
  } catch (error) {
    return apiError(error);
  }
}
