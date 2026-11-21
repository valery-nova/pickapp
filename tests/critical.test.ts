import { beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/types";

type Demo = typeof import("@/lib/data/demo");
type Store = typeof import("@/lib/demo/store");
type Validation = typeof import("@/lib/validation");

let demo: Demo;
let store: Store;
let validation: Validation;

const entrepreneur: SessionUser = {
  id: "user-test",
  clerk_user_id: "demo-entrepreneur",
  email: "demo@pickapp.local",
  full_name: "Demo Emprendedora",
  role: "entrepreneur",
  auth_mode: "demo",
};

beforeAll(async () => {
  process.env.PICKAPP_DATA_MODE = "demo";
  process.env.PICKAPP_AUTH_MODE = "demo";
  process.env.PICKAPP_DEMO_SEED = "true";
  demo = await import("@/lib/data/demo");
  store = await import("@/lib/demo/store");
  validation = await import("@/lib/validation");
  store.resetDemoDb();
});

describe("validation", () => {
  it("rejects invalid orders", () => {
    expect(validation.orderSchema.safeParse({ business_slug: "casa-nova", customer: { name: "A" }, items: [], idempotency_key: "short" }).success).toBe(false);
  });

  it("accepts a minimal valid order", () => {
    expect(
      validation.orderSchema.safeParse({
        business_slug: "casa-nova",
        customer: { name: "Cliente" },
        items: [{ product_id: "p1", quantity: 1 }],
        idempotency_key: "idem-12345678",
      }).success,
    ).toBe(true);
  });
});

describe("demo orders and inventory", () => {
  it("creates idempotent orders and reserves stock once", async () => {
    const business = await demo.demoGetBusinessBySlug("casa-nova");
    expect(business).toBeTruthy();
    const products = await demo.demoGetStoreCatalog(business!.id);
    const product = products[0];
    const before = product.available_quantity ?? 0;
    const input = {
      business_slug: "casa-nova",
      customer: { name: "Cliente Test", email: "cliente@test.dev" },
      items: [{ product_id: product.id, quantity: 2 }],
      idempotency_key: "idem-test-order-0001",
    };
    const first = await demo.demoCreateOrder(input);
    const second = await demo.demoCreateOrder(input);
    expect(second.id).toBe(first.id);
    const after = (await demo.demoGetStoreCatalog(business!.id)).find((item) => item.id === product.id);
    expect(before - (after?.available_quantity ?? 0)).toBe(2);
  });

  it("rejects orders above available stock", async () => {
    const business = await demo.demoGetBusinessBySlug("casa-nova");
    const products = await demo.demoGetStoreCatalog(business!.id);
    await expect(
      demo.demoCreateOrder({
        business_slug: "casa-nova",
        customer: { name: "Cliente Overflow" },
        items: [{ product_id: products[0].id, quantity: 999999 }],
        idempotency_key: "idem-overflow-0001",
      }),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
  });

  it("confirms an order and consumes reserved inventory", async () => {
    const before = await demo.demoGetInventory(entrepreneur);
    const itemBefore = before.find((item) => item.product_name === "Vestido Midi Floral");
    expect(itemBefore).toBeTruthy();
    const order = await demo.demoCreateOrder({
      business_slug: "casa-nova",
      customer: { name: "Cliente Confirm" },
      items: [{ product_id: itemBefore!.product_id, quantity: 1 }],
      idempotency_key: "idem-confirm-0001",
    });
    await demo.demoUpdateOrderStatus(entrepreneur, order.id, "confirmed");
    const after = await demo.demoGetInventory(entrepreneur);
    const itemAfter = after.find((item) => item.product_id === itemBefore!.product_id);
    expect(itemBefore!.quantity - itemAfter!.quantity).toBe(1);
    expect(itemAfter!.reserved_quantity).toBe(0);
  });
});

describe("review hardening", () => {
  it("does not persist rejected orders", async () => {
    const business = await demo.demoGetBusinessBySlug("casa-nova");
    const products = await demo.demoGetStoreCatalog(business!.id);
    const before = (await demo.demoGetStoreCatalog(business!.id)).find((item) => item.id === products[0].id)?.available_quantity ?? 0;
    await expect(
      demo.demoCreateOrder({
        business_slug: "casa-nova",
        customer: { name: "Cliente Rejected" },
        items: [
          { product_id: products[0].id, quantity: 1 },
          { product_id: "missing-product", quantity: 1 },
        ],
        idempotency_key: "idem-rejected-order-01",
      }),
    ).rejects.toThrow("PRODUCT_NOT_AVAILABLE");
    expect(store.getDemoDb().orders.some((order) => order.idempotency_key === "idem-rejected-order-01")).toBe(false);
    const after = (await demo.demoGetStoreCatalog(business!.id)).find((item) => item.id === products[0].id)?.available_quantity ?? 0;
    expect(after).toBe(before);
  });

  it("expires unpaid holds and blocks confirmation", async () => {
    const business = await demo.demoGetBusinessBySlug("casa-nova");
    const products = await demo.demoGetStoreCatalog(business!.id);
    const product = products.find((item) => item.name === "Labial Matte Cereza") ?? products[products.length - 1];
    const before = product.available_quantity ?? 0;
    const order = await demo.demoCreateOrder({
      business_slug: "casa-nova",
      customer: { name: "Cliente Expira" },
      items: [{ product_id: product.id, quantity: 1 }],
      idempotency_key: "idem-expire-hold-0001",
    });
    const reservation = store.getDemoDb().inventoryReservations.find((item) => item.order_id === order.id);
    expect(reservation).toBeTruthy();
    reservation!.expires_at = new Date(Date.now() - 1000).toISOString();
    await demo.demoGetStoreCatalog(business!.id);
    const orders = await demo.demoListOrders(entrepreneur);
    expect(orders.find((item) => item.id === order.id)?.status).toBe("expired");
    await expect(demo.demoUpdateOrderStatus(entrepreneur, order.id, "confirmed")).rejects.toThrow("INVALID_ORDER_TRANSITION");
    const after = (await demo.demoGetStoreCatalog(business!.id)).find((item) => item.id === product.id)?.available_quantity ?? 0;
    expect(after).toBe(before);
  });

  it("restocks inventory when cancelling a confirmed order", async () => {
    const before = await demo.demoGetInventory(entrepreneur);
    const itemBefore = before.find((item) => item.product_name === "Tote Canvas Minimal");
    expect(itemBefore).toBeTruthy();
    const order = await demo.demoCreateOrder({
      business_slug: "casa-nova",
      customer: { name: "Cliente Cancel" },
      items: [{ product_id: itemBefore!.product_id, quantity: 2 }],
      idempotency_key: "idem-cancel-restock-01",
    });
    await demo.demoUpdateOrderStatus(entrepreneur, order.id, "confirmed");
    const confirmed = (await demo.demoGetInventory(entrepreneur)).find((item) => item.product_id === itemBefore!.product_id);
    expect(itemBefore!.quantity - (confirmed?.quantity ?? 0)).toBe(2);
    await demo.demoUpdateOrderStatus(entrepreneur, order.id, "cancelled");
    const cancelled = (await demo.demoGetInventory(entrepreneur)).find((item) => item.product_id === itemBefore!.product_id);
    expect(cancelled?.quantity).toBe(itemBefore!.quantity);
    expect(cancelled?.reserved_quantity).toBe(0);
  });

  it("rejects stock adjustments below active reservations", async () => {
    const before = await demo.demoGetInventory(entrepreneur);
    const itemBefore = before.find((item) => item.product_name === "Bolso Tejido Natural");
    expect(itemBefore).toBeTruthy();
    const order = await demo.demoCreateOrder({
      business_slug: "casa-nova",
      customer: { name: "Cliente Reserva" },
      items: [{ product_id: itemBefore!.product_id, quantity: 1 }],
      idempotency_key: "idem-adjust-reserved-01",
    });
    expect(order.id).toBeTruthy();
    await expect(demo.demoAdjustInventory(entrepreneur, itemBefore!.product_id, -999, "test")).rejects.toThrow("INSUFFICIENT_STOCK");
  });

  it("rejects duplicate product lines that exceed stock in aggregate", async () => {
    const business = await demo.demoGetBusinessBySlug("casa-nova");
    const products = await demo.demoGetStoreCatalog(business!.id);
    const product = products.find((item) => item.name === "Tote Canvas Minimal") ?? products[0];
    await expect(
      demo.demoCreateOrder({
        business_slug: "casa-nova",
        customer: { name: "Cliente Duplicado" },
        items: [
          { product_id: product.id, quantity: 3 },
          { product_id: product.id, quantity: 3 },
        ],
        idempotency_key: "idem-duplicate-lines-01",
      }),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    expect(store.getDemoDb().orders.some((order) => order.idempotency_key === "idem-duplicate-lines-01")).toBe(false);
  });

  it("does not persist product edits when stock validation fails", async () => {
    const inventory = await demo.demoGetInventory(entrepreneur);
    const item = inventory.find((candidate) => candidate.product_name === "Bolso Tejido Natural");
    expect(item).toBeTruthy();
    await expect(
      demo.demoUpdateProduct(entrepreneur, item!.product_id, { name: "No Debe Cambiar", initial_stock: 1 }),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    const products = await demo.demoListBusinessProducts(entrepreneur);
    expect(products.find((product) => product.id === item!.product_id)?.name).not.toBe("No Debe Cambiar");
  });
});

describe("tenant isolation", () => {
  it("does not expose another user business", async () => {
    const outsider: SessionUser = { id: "other", clerk_user_id: null, email: "other@example.com", full_name: "Otra", role: "customer", auth_mode: "demo" };
    await expect(demo.demoGetBusinessForUser(outsider)).resolves.toBeNull();
  });
});
