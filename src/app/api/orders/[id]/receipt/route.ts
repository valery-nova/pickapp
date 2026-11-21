import { apiError, json, requireApiUser } from "@/lib/api";
import { ORDER_RECEIPT_ALGORITHM, orderReceiptHash, orderReceiptPayload } from "@/lib/avalanche-fuji";
import { getOrderReceiptAnchor } from "@/lib/avalanche-fuji-anchoring";
import { getOrder } from "@/lib/data";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const order = await getOrder(user, id);
    const receiptHash = orderReceiptHash(order);
    const avalancheFuji = await getOrderReceiptAnchor(order);
    return json({
      receipt: {
        algorithm: ORDER_RECEIPT_ALGORITHM,
        hash: receiptHash,
        payload: orderReceiptPayload(order),
        avalanche_fuji: avalancheFuji,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
