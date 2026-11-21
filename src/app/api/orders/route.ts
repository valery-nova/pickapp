import { apiError, json, optionalApiUser, parseJson, requireApiUser, requireBusiness } from "@/lib/api";
import { createOrder, listOrders } from "@/lib/data";
import { orderSchema, orderStatusSchema } from "@/lib/validation";
import type { OrderStatus } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const user = await optionalApiUser();
    const input = await parseJson(request, orderSchema);
    if (user?.clerk_user_id) input.customer.clerk_user_id = user.clerk_user_id;
    const order = await createOrder(input);
    return json({ order }, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    await requireBusiness(user);
    const status = new URL(request.url).searchParams.get("status");
    const parsed = status ? orderStatusSchema.safeParse(status) : null;
    return json({ orders: await listOrders(user, parsed?.success ? (parsed.data as OrderStatus) : undefined) });
  } catch (error) {
    return apiError(error);
  }
}
