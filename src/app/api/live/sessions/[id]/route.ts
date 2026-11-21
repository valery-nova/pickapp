import { apiError, json, parseJson, requireApiUser } from "@/lib/api";
import { updateLiveSessionStatus } from "@/lib/data";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const patchSchema = z.object({ status: z.enum(["scheduled", "live", "ended"]) });

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const input = await parseJson(request, patchSchema);
    return json({ session: await updateLiveSessionStatus(user, id, input.status) });
  } catch (error) {
    return apiError(error);
  }
}
