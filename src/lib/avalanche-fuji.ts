import { createHash } from "node:crypto";
import type { OrderDTO } from "@/lib/data/contracts";

export const ORDER_RECEIPT_ALGORITHM = "sha256" as const;

export function orderReceiptPayload(order: OrderDTO) {
  return {
    order_id: order.id,
    business_id: order.business_id,
    created_at: order.created_at,
    subtotal: order.subtotal,
    total: order.total,
    currency: order.currency,
    items: order.items
      .map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))
      .sort(
        (a, b) =>
          a.product_id.localeCompare(b.product_id) ||
          a.unit_price - b.unit_price ||
          a.quantity - b.quantity,
      ),
  };
}

export function orderReceiptHash(order: OrderDTO) {
  return createHash("sha256").update(JSON.stringify(orderReceiptPayload(order))).digest("hex");
}
