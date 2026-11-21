import "server-only";
import { getDemoDb } from "@/lib/demo/store";
import { uniqueSlug } from "@/lib/utils";
import type { DemoDb, SessionUser } from "@/lib/types";
import type {
  AnalyticsReport,
  AssistantCatalogItem,
  BusinessDTO,
  CatalogQuery,
  CreateBusinessInput,
  CreateOrderInput,
  CreateProductInput,
  DashboardMetrics,
  InventoryDTO,
  LiveCommentDTO,
  LiveSessionDTO,
  OrderDTO,
  ProductDTO,
  UpdateProductInput,
} from "./contracts";
import type { OrderStatus as OrderStatusType } from "@/lib/types";

function now() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID();
}

function ensureProfile(user: SessionUser) {
  const db = getDemoDb();
  let profile = db.profiles.find(
    (item) => item.id === user.id || item.clerk_user_id === user.clerk_user_id,
  );
  if (!profile) {
    profile = {
      id: user.id,
      clerk_user_id: user.clerk_user_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      created_at: now(),
    };
    db.profiles.push(profile);
  } else {
    profile.email = user.email || profile.email;
    profile.full_name = user.full_name || profile.full_name;
    if (user.role === "entrepreneur") profile.role = "entrepreneur";
  }
  return profile;
}

function businessForProfile(profileId: string) {
  return getDemoDb().businesses.find(
    (business) => business.owner_profile_id === profileId && business.status !== "archived",
  );
}

function requireBusinessForUser(user: SessionUser): BusinessDTO {
  const profile = ensureProfile(user);
  const business = businessForProfile(profile.id);
  if (!business) throw new Error("BUSINESS_NOT_FOUND");
  return business as BusinessDTO;
}

function productDTO(productId: string): ProductDTO {
  const db = getDemoDb();
  const product = db.products.find((item) => item.id === productId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const images = db.productImages
    .filter((image) => image.product_id === product.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({ id: image.id, url: image.url, alt: image.alt, sort_order: image.sort_order }));
  const variants = db.productVariants
    .filter((variant) => variant.product_id === product.id)
    .map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price_override: variant.price_override,
    }));
  const inventory = db.inventory.find((item) => item.product_id === product.id);
  return {
    ...product,
    image_url: images[0]?.url ?? null,
    images,
    variants,
    available_quantity: inventory ? inventory.quantity - inventory.reserved_quantity : null,
    reserved_quantity: inventory?.reserved_quantity ?? null,
    low_stock_threshold: inventory?.low_stock_threshold ?? null,
  };
}

function orderDTO(orderId: string): OrderDTO {
  const db = getDemoDb();
  const order = db.orders.find((item) => item.id === orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const customer = db.customers.find((item) => item.id === order.customer_id);
  return {
    ...order,
    customer_name: customer?.name ?? null,
    customer_email: customer?.email ?? null,
    items: db.orderItems
      .filter((item) => item.order_id === order.id)
      .map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
      })),
  };
}

function liveSessionDTO(sessionId: string): LiveSessionDTO {
  expireReservations();
  const db = getDemoDb();
  const session = db.liveSessions.find((item) => item.id === sessionId);
  if (!session) throw new Error("LIVE_SESSION_NOT_FOUND");
  const featuredIds = new Set(session.featured_product_ids);
  const featuredProducts = db.products
    .filter((product) => featuredIds.has(product.id) && product.business_id === session.business_id && product.status === "published")
    .sort((a, b) => session.featured_product_ids.indexOf(a.id) - session.featured_product_ids.indexOf(b.id))
    .map((product) => productDTO(product.id));
  return {
    ...session,
    featured_products: featuredProducts,
  };
}

function matchesCatalog(product: ReturnType<typeof productDTO>, query: CatalogQuery) {
  if (query.featured && !product.featured) return false;
  if (query.inStock && (product.available_quantity ?? 0) <= 0) return false;
  const q = query.q?.trim().toLowerCase();
  if (!q) return true;
  return [product.name, product.description, product.category, ...product.tags]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export async function demoEnsureProfile(user: SessionUser) {
  return ensureProfile(user);
}

export async function demoGetBusinessForUser(user: SessionUser) {
  const profile = ensureProfile(user);
  return businessForProfile(profile.id) ?? null;
}

export async function demoCreateBusiness(user: SessionUser, input: CreateBusinessInput) {
  ensureProfile(user).role = "entrepreneur";
  const db = getDemoDb();
  const existing = db.businesses.map((business) => business.slug);
  const business = {
    id: id(),
    owner_profile_id: ensureProfile(user).id,
    name: input.name.trim(),
    slug: uniqueSlug(input.name, existing),
    description: input.description?.trim() ?? "",
    category: input.category?.trim() ?? "",
    logo_url: input.logo_url ?? null,
    cover_url: input.cover_url ?? null,
    contact_email: input.contact_email?.trim() ?? null,
    contact_phone: input.contact_phone?.trim() ?? null,
    status: "active" as const,
    created_at: now(),
    updated_at: now(),
  };
  db.businesses.push(business);
  db.notificationPreferences.push({
    id: id(),
    business_id: business.id,
    channel: "app",
    enabled: true,
    config: { email: business.contact_email },
    updated_at: now(),
  });
  db.automationLogs.push({
    id: id(),
    business_id: business.id,
    workflow: "business-onboarding",
    event: "business.created",
    status: "success",
    payload: { slug: business.slug },
    created_at: now(),
  });
  return business as BusinessDTO;
}

export async function demoListBusinesses() {
  const db = getDemoDb();
  return db.businesses
    .filter((business) => business.status === "active")
    .map((business) => ({
      ...business,
      product_count: db.products.filter(
        (product) => product.business_id === business.id && product.status === "published",
      ).length,
    }));
}

export async function demoGetBusinessBySlug(slug: string) {
  const db = getDemoDb();
  return db.businesses.find((business) => business.slug === slug && business.status === "active") ?? null;
}

export async function demoGetStoreCatalog(businessId: string, query: CatalogQuery = {}) {
  expireReservations();
  const db = getDemoDb();
  const category = query.category?.trim().toLowerCase();
  return db.products
    .filter((product) => product.business_id === businessId && product.status === "published")
    .map((product) => productDTO(product.id))
    .filter((product) => {
      if (category && product.category.toLowerCase() !== category) return false;
      return matchesCatalog(product, query);
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
}

export async function demoGetStoreProduct(businessId: string, productId: string) {
  expireReservations();
  const db = getDemoDb();
  const product = db.products.find(
    (item) => item.id === productId && item.business_id === businessId && item.status === "published",
  );
  if (!product) return null;
  return productDTO(product.id);
}

export async function demoListBusinessProducts(user: SessionUser) {
  const business = requireBusinessForUser(user);
  const db = getDemoDb();
  return db.products
    .filter((product) => product.business_id === business.id)
    .map((product) => productDTO(product.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function demoCreateProduct(user: SessionUser, input: CreateProductInput) {
  const business = requireBusinessForUser(user);
  const db = getDemoDb();
  const existing = db.products.filter((product) => product.business_id === business.id).map((p) => p.slug);
  const product = {
    id: id(),
    business_id: business.id,
    name: input.name.trim(),
    slug: uniqueSlug(input.name, existing),
    description: input.description?.trim() ?? "",
    category: input.category?.trim() ?? "",
    tags: input.tags ?? [],
    price: input.price,
    currency: input.currency ?? "BOB",
    status: input.status ?? "draft",
    featured: input.featured ?? false,
    ai_generated: input.ai_generated ?? false,
    created_at: now(),
    updated_at: now(),
  };
  db.products.push(product);
  if (input.image_url) {
    db.productImages.push({
      id: id(),
      product_id: product.id,
      storage_path: input.image_url,
      url: input.image_url,
      alt: product.name,
      sort_order: 0,
      created_at: now(),
    });
  }
  db.inventory.push({
    id: id(),
    business_id: business.id,
    product_id: product.id,
    quantity: input.initial_stock ?? 0,
    reserved_quantity: 0,
    low_stock_threshold: input.low_stock_threshold ?? 3,
    updated_at: now(),
  });
  for (const variant of input.variants ?? []) {
    db.productVariants.push({
      id: id(),
      product_id: product.id,
      name: variant.name,
      sku: variant.sku ?? null,
      price_override: variant.price_override ?? null,
      created_at: now(),
    });
  }
  db.automationLogs.push({
    id: id(),
    business_id: business.id,
    workflow: "ai-product-creator",
    event: input.ai_generated ? "product.ai_draft_saved" : "product.created",
    status: "success",
    payload: { product_id: product.id, status: product.status },
    created_at: now(),
  });
  return productDTO(product.id);
}

export async function demoUpdateProduct(user: SessionUser, productId: string, input: UpdateProductInput) {
  const business = requireBusinessForUser(user);
  const db = getDemoDb();
  const product = db.products.find((item) => item.id === productId && item.business_id === business.id);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  if (input.name) product.name = input.name.trim();
  if (input.description !== undefined) product.description = input.description.trim();
  if (input.category !== undefined) product.category = input.category.trim();
  if (input.tags) product.tags = input.tags;
  if (input.price !== undefined) product.price = input.price;
  if (input.currency) product.currency = input.currency;
  if (input.status) product.status = input.status;
  if (input.featured !== undefined) product.featured = input.featured;
  if (input.ai_generated !== undefined) product.ai_generated = input.ai_generated;
  product.updated_at = now();
  if (input.image_url) {
    const existingImage = db.productImages.find((image) => image.product_id === product.id);
    if (existingImage) {
      existingImage.url = input.image_url;
      existingImage.storage_path = input.image_url;
    } else {
      db.productImages.push({
        id: id(),
        product_id: product.id,
        storage_path: input.image_url,
        url: input.image_url,
        alt: product.name,
        sort_order: 0,
        created_at: now(),
      });
    }
  }
  if (input.initial_stock !== undefined) {
    const inventory = db.inventory.find((item) => item.product_id === product.id);
    if (inventory) {
      const nextQuantity = Math.max(0, input.initial_stock);
      if (nextQuantity < inventory.reserved_quantity) throw new Error("INSUFFICIENT_STOCK");
      inventory.quantity = nextQuantity;
      inventory.updated_at = now();
    }
  }
  if (input.low_stock_threshold !== undefined) {
    const inventory = db.inventory.find((item) => item.product_id === product.id);
    if (inventory) inventory.low_stock_threshold = input.low_stock_threshold;
  }
  db.automationLogs.push({
    id: id(),
    business_id: business.id,
    workflow: "product-management",
    event: "product.updated",
    status: "success",
    payload: { product_id: product.id, status: product.status },
    created_at: now(),
  });
  return productDTO(product.id);
}

export async function demoGetInventory(user: SessionUser): Promise<InventoryDTO[]> {
  const business = requireBusinessForUser(user);
  expireReservations();
  const db = getDemoDb();
  return db.inventory
    .filter((item) => item.business_id === business.id)
    .map((item) => {
      const product = db.products.find((p) => p.id === item.product_id);
      const available = item.quantity - item.reserved_quantity;
      return {
        product_id: item.product_id,
        product_name: product?.name ?? "Producto",
        quantity: item.quantity,
        reserved_quantity: item.reserved_quantity,
        available_quantity: available,
        low_stock_threshold: item.low_stock_threshold,
        low_stock: available <= item.low_stock_threshold,
      };
    })
    .sort((a, b) => a.product_name.localeCompare(b.product_name));
}

export async function demoAdjustInventory(
  user: SessionUser,
  productId: string,
  delta: number,
  reason: string,
) {
  const business = requireBusinessForUser(user);
  const db = getDemoDb();
  const inventory = db.inventory.find((item) => item.product_id === productId && item.business_id === business.id);
  if (!inventory) throw new Error("INVENTORY_NOT_FOUND");
  const nextQuantity = inventory.quantity + delta;
  if (nextQuantity < inventory.reserved_quantity) throw new Error("INSUFFICIENT_STOCK");
  inventory.quantity = nextQuantity;
  inventory.updated_at = now();
  db.inventoryMovements.push({
    id: id(),
    business_id: business.id,
    product_id: productId,
    delta,
    reason,
    reference_type: "manual",
    reference_id: null,
    created_at: now(),
  });
  db.automationLogs.push({
    id: id(),
    business_id: business.id,
    workflow: "inventory-automation",
    event: "inventory.adjusted",
    status: "success",
    payload: { product_id: productId, delta, reason },
    created_at: now(),
  });
  return demoGetInventory(user);
}

function expireReservations() {
  const db = getDemoDb();
  const expired = db.inventoryReservations.filter(
    (reservation) => reservation.status === "active" && new Date(reservation.expires_at).getTime() < Date.now(),
  );
  const affectedOrderIds = new Set<string>();
  for (const reservation of expired) {
    const inventory = db.inventory.find((item) => item.product_id === reservation.product_id);
    if (inventory) {
      inventory.reserved_quantity = Math.max(0, inventory.reserved_quantity - reservation.quantity);
      inventory.updated_at = now();
    }
    reservation.status = "expired";
    if (reservation.order_id) affectedOrderIds.add(reservation.order_id);
  }
  for (const orderId of affectedOrderIds) {
    const order = db.orders.find((item) => item.id === orderId);
    if (!order || !["pending", "awaiting_payment"].includes(order.status)) continue;
    for (const reservation of db.inventoryReservations.filter(
      (item) => item.order_id === orderId && item.status === "active",
    )) {
      const inventory = db.inventory.find((item) => item.product_id === reservation.product_id);
      if (inventory) {
        inventory.reserved_quantity = Math.max(0, inventory.reserved_quantity - reservation.quantity);
        inventory.updated_at = now();
      }
      reservation.status = "expired";
    }
    order.status = "expired";
    order.updated_at = now();
  }
}

export async function demoCreateOrder(input: CreateOrderInput) {
  expireReservations();
  const db = getDemoDb();
  const business = db.businesses.find((item) => item.slug === input.business_slug && item.status === "active");
  if (!business) throw new Error("BUSINESS_NOT_FOUND");
  const existing = db.orders.find(
    (order) => order.business_id === business.id && order.idempotency_key === input.idempotency_key,
  );
  if (existing) return orderDTO(existing.id);
  if (input.items.length === 0) throw new Error("ORDER_EMPTY");

  const preparedItems: Array<{
    product: DemoDb["products"][number];
    inventory: DemoDb["inventory"][number];
    quantity: number;
    unitPrice: number;
  }> = [];
  let subtotal = 0;
  let currency = "BOB";
  for (const item of input.items) {
    const product = db.products.find(
      (candidate) => candidate.id === item.product_id && candidate.business_id === business.id && candidate.status === "published",
    );
    if (!product) throw new Error("PRODUCT_NOT_AVAILABLE");
    const inventory = db.inventory.find((candidate) => candidate.product_id === product.id);
    const available = inventory ? inventory.quantity - inventory.reserved_quantity : 0;
    if (!inventory || available < item.quantity) throw new Error("INSUFFICIENT_STOCK");
    preparedItems.push({ product, inventory, quantity: item.quantity, unitPrice: product.price });
    subtotal += product.price * item.quantity;
    currency = product.currency;
  }

  const customer = {
    id: id(),
    business_id: business.id,
    name: input.customer.name.trim() || "Cliente PICKAPP",
    email: input.customer.email?.trim() || null,
    phone: input.customer.phone?.trim() || null,
    clerk_user_id: input.customer.clerk_user_id ?? null,
    created_at: now(),
  };
  db.customers.push(customer);

  const order = {
    id: id(),
    business_id: business.id,
    customer_id: customer.id,
    status: "pending" as OrderStatusType,
    subtotal,
    total: subtotal,
    currency,
    idempotency_key: input.idempotency_key,
    shipping_address: input.shipping_address ?? null,
    notes: input.notes ?? null,
    created_at: now(),
    updated_at: now(),
    confirmed_at: null,
    paid_at: null,
  };
  db.orders.push(order);

  for (const item of preparedItems) {
    db.orderItems.push({
      id: id(),
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      unit_price: item.unitPrice,
      quantity: item.quantity,
    });
    db.inventoryReservations.push({
      id: id(),
      business_id: business.id,
      product_id: item.product.id,
      order_id: order.id,
      quantity: item.quantity,
      status: "active",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      created_at: now(),
    });
    item.inventory.reserved_quantity += item.quantity;
    item.inventory.updated_at = now();
  }
  order.updated_at = now();

  db.automationLogs.push({
    id: id(),
    business_id: business.id,
    workflow: "smart-order-manager",
    event: "order.created",
    status: "success",
    payload: { order_id: order.id, idempotency_key: input.idempotency_key, total: subtotal },
    created_at: now(),
  });
  db.automationLogs.push({
    id: id(),
    business_id: business.id,
    workflow: "customer-follow-up",
    event: "order.pending_notification",
    status: "success",
    payload: { order_id: order.id, channel: "app" },
    created_at: now(),
  });
  return orderDTO(order.id);
}

const transitions: Record<OrderStatusType, OrderStatusType[]> = {
  pending: ["awaiting_payment", "confirmed", "cancelled", "expired"],
  awaiting_payment: ["confirmed", "cancelled", "expired"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  expired: [],
};

export async function demoListOrders(user: SessionUser, status?: OrderStatusType) {
  const business = requireBusinessForUser(user);
  const db = getDemoDb();
  expireReservations();
  return db.orders
    .filter((order) => order.business_id === business.id && (!status || order.status === status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((order) => orderDTO(order.id));
}

export async function demoUpdateOrderStatus(user: SessionUser, orderId: string, status: OrderStatusType) {
  const business = requireBusinessForUser(user);
  const db = getDemoDb();
  expireReservations();
  const order = db.orders.find((item) => item.id === orderId && item.business_id === business.id);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!transitions[order.status].includes(status)) throw new Error("INVALID_ORDER_TRANSITION");

  if (["confirmed", "processing", "shipped", "delivered"].includes(status)) {
    for (const reservation of db.inventoryReservations.filter(
      (item) => item.order_id === order.id && item.status === "active",
    )) {
      const inventory = db.inventory.find((item) => item.product_id === reservation.product_id);
      if (inventory) {
        inventory.quantity = Math.max(0, inventory.quantity - reservation.quantity);
        inventory.reserved_quantity = Math.max(0, inventory.reserved_quantity - reservation.quantity);
        inventory.updated_at = now();
      }
      reservation.status = "consumed";
      db.inventoryMovements.push({
        id: id(),
        business_id: business.id,
        product_id: reservation.product_id,
        delta: -reservation.quantity,
        reason: `order_${status}`,
        reference_type: "order",
        reference_id: order.id,
        created_at: now(),
      });
    }
    if (!order.confirmed_at) order.confirmed_at = now();
  }
  if (["cancelled", "expired"].includes(status)) {
    const shouldRestock = order.status === "confirmed" || order.status === "processing";
    for (const reservation of db.inventoryReservations.filter(
      (item) => item.order_id === order.id && (item.status === "active" || item.status === "consumed"),
    )) {
      const inventory = db.inventory.find((item) => item.product_id === reservation.product_id);
      if (inventory) {
        if (reservation.status === "active") {
          inventory.reserved_quantity = Math.max(0, inventory.reserved_quantity - reservation.quantity);
        } else if (shouldRestock) {
          inventory.quantity += reservation.quantity;
          db.inventoryMovements.push({
            id: id(),
            business_id: business.id,
            product_id: reservation.product_id,
            delta: reservation.quantity,
            reason: `order_${status}_restock`,
            reference_type: "order",
            reference_id: order.id,
            created_at: now(),
          });
        }
        inventory.updated_at = now();
      }
      reservation.status = status === "expired" ? "expired" : "released";
    }
  }

  order.status = status;
  order.updated_at = now();
  db.automationLogs.push({
    id: id(),
    business_id: business.id,
    workflow: "smart-order-manager",
    event: "order.status_changed",
    status: "success",
    payload: { order_id: order.id, status },
    created_at: now(),
  });
  return orderDTO(order.id);
}

export async function demoGetDashboardMetrics(user: SessionUser): Promise<DashboardMetrics> {
  const business = requireBusinessForUser(user);
  const db = getDemoDb();
  expireReservations();
  const orders = db.orders.filter((order) => order.business_id === business.id);
  const confirmedStatuses: OrderStatusType[] = ["confirmed", "processing", "shipped", "delivered"];
  const pendingStatuses: OrderStatusType[] = ["pending", "awaiting_payment"];
  const confirmedRevenue = orders
    .filter((order) => confirmedStatuses.includes(order.status))
    .reduce((sum, order) => sum + order.total, 0);
  const pendingRevenue = orders
    .filter((order) => pendingStatuses.includes(order.status))
    .reduce((sum, order) => sum + order.total, 0);
  const products = db.products.filter((product) => product.business_id === business.id);
  const inventory = db.inventory.filter((item) => item.business_id === business.id);
  const soldItems = db.orderItems.filter((item) =>
    orders.some((order) => order.id === item.order_id && !["cancelled", "expired"].includes(order.status)),
  );
  const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of soldItems) {
    const order = orders.find((candidate) => candidate.id === item.order_id);
    if (!order) continue;
    const current = productSales.get(item.product_id) ?? { name: item.product_name, quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += item.unit_price * item.quantity;
    productSales.set(item.product_id, current);
  }
  const topProducts = [...productSales.entries()]
    .map(([product_id, value]) => ({ product_id, ...value }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  const recentOrders = orders
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8)
    .map((order) => orderDTO(order.id));
  const recentActivity = [
    ...orders.slice(0, 5).map((order) => ({
      id: order.id,
      label: `Pedido ${order.id.slice(0, 8)} · ${order.status}`,
      created_at: order.created_at,
    })),
    ...db.automationLogs
      .filter((log) => log.business_id === business.id)
      .slice(0, 5)
      .map((log) => ({ id: log.id, label: `${log.workflow}: ${log.event}`, created_at: log.created_at })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);
  return {
    business_id: business.id,
    currency: "BOB",
    confirmed_revenue: confirmedRevenue,
    pending_revenue: pendingRevenue,
    orders_total: orders.length,
    orders_pending: orders.filter((order) => pendingStatuses.includes(order.status)).length,
    products_published: products.filter((product) => product.status === "published").length,
    products_draft: products.filter((product) => product.status === "draft").length,
    low_stock_count: inventory.filter((item) => item.quantity - item.reserved_quantity <= item.low_stock_threshold && item.quantity - item.reserved_quantity > 0).length,
    out_of_stock_count: inventory.filter((item) => item.quantity - item.reserved_quantity <= 0).length,
    top_products: topProducts,
    recent_orders: recentOrders,
    recent_activity: recentActivity,
  };
}

export async function demoListLiveSessions(user: SessionUser) {
  const business = requireBusinessForUser(user);
  const db = getDemoDb();
  return db.liveSessions
    .filter((session) => session.business_id === business.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((session) => liveSessionDTO(session.id));
}

export async function demoCreateLiveSession(user: SessionUser, input: { title: string; description?: string; featured_product_ids?: string[] }) {
  const business = requireBusinessForUser(user);
  const db = getDemoDb();
  const featuredIds = input.featured_product_ids ?? [];
  for (const productId of featuredIds) {
    const product = db.products.find((item) => item.id === productId && item.business_id === business.id && item.status === "published");
    if (!product) throw new Error("PRODUCT_NOT_AVAILABLE");
  }
  const session = {
    id: id(),
    business_id: business.id,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    status: "scheduled" as const,
    featured_product_ids: input.featured_product_ids ?? [],
    started_at: null,
    ended_at: null,
    created_at: now(),
  };
  db.liveSessions.push(session);
  db.automationLogs.push({
    id: id(),
    business_id: business.id,
    workflow: "live-sessions",
    event: "live.created",
    status: "success",
    payload: { live_session_id: session.id },
    created_at: now(),
  });
  return liveSessionDTO(session.id);
}

export async function demoUpdateLiveSessionStatus(user: SessionUser, sessionId: string, status: "scheduled" | "live" | "ended") {
  const business = requireBusinessForUser(user);
  const db = getDemoDb();
  const session = db.liveSessions.find((item) => item.id === sessionId && item.business_id === business.id);
  if (!session) throw new Error("LIVE_SESSION_NOT_FOUND");
  session.status = status;
  session.started_at = status === "live" ? now() : session.started_at;
  session.ended_at = status === "ended" ? now() : session.ended_at;
  db.automationLogs.push({
    id: id(),
    business_id: business.id,
    workflow: "live-sessions",
    event: `live.${status}`,
    status: "success",
    payload: { live_session_id: session.id },
    created_at: now(),
  });
  return liveSessionDTO(session.id);
}

export async function demoAddLiveComment(input: { live_session_id: string; customer_name: string; message: string; product_id?: string | null }) {
  const db = getDemoDb();
  const session = db.liveSessions.find((item) => item.id === input.live_session_id);
  if (!session) throw new Error("LIVE_SESSION_NOT_FOUND");
  if (input.product_id) {
    const product = db.products.find((item) => item.id === input.product_id && item.business_id === session.business_id && item.status === "published");
    if (!product) throw new Error("PRODUCT_NOT_AVAILABLE");
  }
  const comment = {
    id: id(),
    live_session_id: session.id,
    customer_name: input.customer_name.trim() || "Cliente",
    message: input.message.trim(),
    product_id: input.product_id ?? null,
    created_at: now(),
  };
  db.liveComments.push(comment);
  db.automationLogs.push({
    id: id(),
    business_id: session.business_id,
    workflow: "live-interactions",
    event: "live.comment",
    status: "success",
    payload: { live_session_id: session.id, product_id: comment.product_id },
    created_at: now(),
  });
  return comment;
}

export async function demoListLiveComments(liveSessionId: string): Promise<LiveCommentDTO[]> {
  const db = getDemoDb();
  return db.liveComments
    .filter((comment) => comment.live_session_id === liveSessionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((comment) => {
      const product = comment.product_id ? db.products.find((item) => item.id === comment.product_id && item.status === "published") : null;
      return {
        ...comment,
        product_name: product?.name ?? null,
      };
    });
}

export async function demoGetLiveSessionById(sessionId: string) {
  try {
    return liveSessionDTO(sessionId);
  } catch {
    return null;
  }
}

export async function demoGetAssistantCatalog(businessId: string): Promise<AssistantCatalogItem[]> {
  const products = await demoGetStoreCatalog(businessId, {});
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    tags: product.tags,
    price: product.price,
    currency: product.currency,
    available_quantity: product.available_quantity ?? 0,
    variants: product.variants,
  }));
}

export async function demoGetAnalyticsReport(user: SessionUser, days = 30): Promise<AnalyticsReport> {
  const metrics = await demoGetDashboardMetrics(user);
  const recommendations: string[] = [];
  if (metrics.low_stock_count > 0) recommendations.push("Reponer stock bajo antes del próximo LIVE para evitar ventas perdidas.");
  if (metrics.pending_revenue > 0) recommendations.push("Hacer seguimiento a pedidos pendientes para moverlos a confirmados.");
  if (metrics.top_products.length > 0) recommendations.push(`Impulsar ${metrics.top_products[0].name} en la próxima transmisión LIVE.`);
  if (metrics.products_draft > 0) recommendations.push("Publicar borradores con IA para mantener el catálogo fresco.");
  if (recommendations.length === 0) recommendations.push("Publicar productos y crear una sesión LIVE para activar recomendaciones.");
  const narrative = `En los últimos ${days} días, ${metrics.business_id ? "el negocio" : "la tienda"} registró ${metrics.orders_total} pedidos, ${metrics.orders_pending} pendientes y ${formatReportCurrency(metrics.confirmed_revenue, metrics.currency)} en ventas confirmadas. ${metrics.top_products[0] ? `El producto más vendido es ${metrics.top_products[0].name}.` : "Aún no hay productos vendidos."}`;
  return {
    business_id: metrics.business_id,
    generated_at: now(),
    period_days: days,
    metrics,
    recommendations,
    narrative,
  };
}

function formatReportCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("es-BO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export async function demoListPublicLiveSessions(businessId: string) {
  const db = getDemoDb();
  const sessions = await Promise.all(
    db.liveSessions
      .filter((session) => session.business_id === businessId && (session.status === "live" || session.status === "scheduled"))
      .map((session) => liveSessionDTO(session.id)),
  );
  return sessions.sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || b.created_at.localeCompare(a.created_at));
}

export async function demoGetBusinessById(businessId: string) {
  const business = getDemoDb().businesses.find((item) => item.id === businessId && item.status !== "archived");
  return (business as BusinessDTO | undefined) ?? null;
}
