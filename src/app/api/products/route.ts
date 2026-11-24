import { apiError, json, parseJson, requireApiUser, requireBusiness } from "@/lib/api";
import { createProduct, listBusinessProducts } from "@/lib/data";
import { productSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireApiUser();
    await requireBusiness(user);
    return json({ products: await listBusinessProducts(user) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    await requireBusiness(user);
    const input = await parseJson(request, productSchema);
    return json({ product: await createProduct(user, input) }, 201);
  } catch (error) {
    return apiError(error);
  }
}
