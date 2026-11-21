import { apiError, json, requireApiUser } from "@/lib/api";
import { ORDER_RECEIPT_ALGORITHM, orderReceiptHash, orderReceiptPayload } from "@/lib/avalanche-fuji";
import { getOrder } from "@/lib/data";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const order = await getOrder(user, id);
    return json({
      receipt: {
        algorithm: ORDER_RECEIPT_ALGORITHM,
        hash: orderReceiptHash(order),
        payload: orderReceiptPayload(order),
        avalanche_fuji: { status: "prepared", anchored: false },
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
