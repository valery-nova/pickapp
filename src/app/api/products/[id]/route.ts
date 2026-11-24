import { apiError, json, parseJson, requireApiUser } from "@/lib/api";
import { updateProduct } from "@/lib/data";
import { productUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const input = await parseJson(request, productUpdateSchema);
    return json({ product: await updateProduct(user, id, input) });
  } catch (error) {
    return apiError(error);
  }
}
