import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { uniqueSlug } from "@/lib/utils";
import type { SessionUser } from "@/lib/types";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function now() {
  return new Date().toISOString();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function unwrap<T>({ data, error }: { data: T | null; error: { message?: string } | null }): T {
  if (error) throw new Error(error.message ?? "SUPABASE_ERROR");
  if (data === null) throw new Error("SUPABASE_EMPTY_RESULT");
  return data;
}

async function releaseExpiredReservations() {
  const supabase = getSupabaseServerClient();
  const result = await supabase.rpc("release_expired_reservations");
  if (result.error) throw new Error(result.error.message);
}

async function ensureProfile(user: SessionUser) {
  const supabase = getSupabaseServerClient();
  let query = supabase.from("profiles").select("*");
  if (user.clerk_user_id) {
    query = query.eq("clerk_user_id", user.clerk_user_id);
  } else if (isUuid(user.id)) {
    query = query.eq("id", user.id);
  } else {
    query = query.eq("email", user.email);
  }
  const existing = await query.maybeSingle();
  if (existing.data) {
    const updated = await supabase
      .from("profiles")
      .update({
        email: user.email || existing.data.email,
        full_name: user.full_name || existing.data.full_name,
        role: user.role === "entrepreneur" ? "entrepreneur" : existing.data.role,
      })
      .eq("id", existing.data.id)
      .select("*")
      .single();
    return unwrap(updated) as Row;
  }
  const inserted = await supabase
    .from("profiles")
    .insert({
      clerk_user_id: user.clerk_user_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    })
    .select("*")
    .single();
  return unwrap(inserted) as Row;
}

async function businessForProfile(profileId: string) {
  const supabase = getSupabaseServerClient();
  const result = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_profile_id", profileId)
    .neq("status", "archived")
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return (result.data as BusinessDTO | null) ?? null;
}

async function requireBusinessForUser(user: SessionUser) {
  const profile = await ensureProfile(user);
  const business = await businessForProfile(profile.id);
  if (!business) throw new Error("BUSINESS_NOT_FOUND");
  return { profile, business };
}

function productDTOFromParts(product: Row, images: Row[], variants: Row[], inventory?: Row | null): ProductDTO {
  const sortedImages = images
    .filter((image) => image.product_id === product.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return {
    id: product.id,
    business_id: product.business_id,
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    category: product.category ?? "",
    tags: product.tags ?? [],
    price: Number(product.price),
    currency: product.currency ?? "BOB",
    status: product.status,
    featured: Boolean(product.featured),
    ai_generated: Boolean(product.ai_generated),
    image_url: sortedImages[0]?.url ?? null,
    images: sortedImages.map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt ?? null,
      sort_order: image.sort_order ?? 0,
    })),
    variants: variants
      .filter((variant) => variant.product_id === product.id)
      .map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku ?? null,
        price_override: variant.price_override === null ? null : Number(variant.price_override),
      })),
    available_quantity: inventory ? Number(inventory.quantity) - Number(inventory.reserved_quantity) : null,
    reserved_quantity: inventory ? Number(inventory.reserved_quantity) : null,
    low_stock_threshold: inventory ? Number(inventory.low_stock_threshold) : null,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

async function productDTO(productId: string) {
  const supabase = getSupabaseServerClient();
  const productResult = await supabase.from("products").select("*").eq("id", productId).single();
  const product = unwrap(productResult) as Row;
  const [imagesResult, variantsResult, inventoryResult] = await Promise.all([
    supabase.from("product_images").select("*").eq("product_id", productId),
    supabase.from("product_variants").select("*").eq("product_id", productId),
    supabase.from("inventory").select("*").eq("product_id", productId).maybeSingle(),
  ]);
  if (imagesResult.error) throw new Error(imagesResult.error.message);
  if (variantsResult.error) throw new Error(variantsResult.error.message);
  if (inventoryResult.error) throw new Error(inventoryResult.error.message);
  return productDTOFromParts(product, imagesResult.data ?? [], variantsResult.data ?? [], inventoryResult.data);
}

async function productsDTO(products: Row[]) {
  if (products.length === 0) return [];
  const supabase = getSupabaseServerClient();
  const productIds = products.map((product) => product.id);
  const [imagesResult, variantsResult, inventoryResult] = await Promise.all([
    supabase.from("product_images").select("*").in("product_id", productIds),
    supabase.from("product_variants").select("*").in("product_id", productIds),
    supabase.from("inventory").select("*").in("product_id", productIds),
  ]);
  if (imagesResult.error) throw new Error(imagesResult.error.message);
  if (variantsResult.error) throw new Error(variantsResult.error.message);
  if (inventoryResult.error) throw new Error(inventoryResult.error.message);
  const images = imagesResult.data ?? [];
  const variants = variantsResult.data ?? [];
  const inventory = inventoryResult.data ?? [];
  return products.map((product) =>
    productDTOFromParts(product, images, variants, inventory.find((item) => item.product_id === product.id)),
  );
}

async function orderDTO(orderId: string) {
  const supabase = getSupabaseServerClient();
  const orderResult = await supabase.from("orders").select("*, customers(name,email)").eq("id", orderId).single();
  const order = unwrap(orderResult) as Row;
  const itemsResult = await supabase.from("order_items").select("*").eq("order_id", orderId);
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  return {
    id: order.id,
    business_id: order.business_id,
    customer_id: order.customer_id,
    status: order.status,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    currency: order.currency,
    idempotency_key: order.idempotency_key,
    shipping_address: order.shipping_address ?? null,
    notes: order.notes ?? null,
    customer_name: order.customers?.name ?? null,
    customer_email: order.customers?.email ?? null,
    items: (itemsResult.data ?? []).map((item: Row) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      unit_price: Number(item.unit_price),
      quantity: item.quantity,
    })),
    created_at: order.created_at,
    updated_at: order.updated_at,
  } satisfies OrderDTO;
}

async function liveSessionDTO(sessionId: string) {
  const supabase = getSupabaseServerClient();
  const sessionResult = await supabase.from("live_sessions").select("*").eq("id", sessionId).single();
  const session = unwrap(sessionResult) as Row;
  const featuredIds = (session.featured_product_ids ?? []) as string[];
  const featuredResult = featuredIds.length
    ? await supabase
        .from("products")
        .select("*")
        .in("id", featuredIds)
        .eq("business_id", session.business_id)
        .eq("status", "published")
    : { data: [], error: null };
  if (featuredResult.error) throw new Error(featuredResult.error.message);
  const featuredProducts = await productsDTO((featuredResult.data ?? []) as Row[]);
  const featuredOrder = new Map(featuredIds.map((productId, index) => [productId, index]));
  featuredProducts.sort((a, b) => (featuredOrder.get(a.id) ?? 0) - (featuredOrder.get(b.id) ?? 0));
  return {
    id: session.id,
    business_id: session.business_id,
    title: session.title,
    description: session.description ?? null,
    status: session.status,
    featured_product_ids: session.featured_product_ids ?? [],
    featured_products: featuredProducts,
    started_at: session.started_at ?? null,
    ended_at: session.ended_at ?? null,
    created_at: session.created_at,
  } satisfies LiveSessionDTO;
}

export async function supabaseEnsureProfile(user: SessionUser) {
  return ensureProfile(user);
}

export async function supabaseGetBusinessForUser(user: SessionUser) {
  const profile = await ensureProfile(user);
  return businessForProfile(profile.id);
}

export async function supabaseCreateBusiness(user: SessionUser, input: CreateBusinessInput) {
  const profile = await ensureProfile(user);
  const supabase = getSupabaseServerClient();
  const slug = uniqueSlug(input.name, []);
  const businessResult = await supabase
    .from("businesses")
    .insert({
      owner_profile_id: profile.id,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() ?? "",
      category: input.category?.trim() ?? "",
      logo_url: input.logo_url ?? null,
      cover_url: input.cover_url ?? null,
      contact_email: input.contact_email?.trim() ?? null,
      contact_phone: input.contact_phone?.trim() ?? null,
      status: "active",
    })
    .select("*")
    .single();
  const business = unwrap(businessResult) as BusinessDTO;
  await supabase.from("business_members").insert({ business_id: business.id, profile_id: profile.id, role: "owner" });
  await supabase.from("notification_preferences").insert({
    business_id: business.id,
    channel: "app",
    enabled: true,
    config: { email: business.contact_email },
  });
  await supabase.from("automation_logs").insert({
    business_id: business.id,
    workflow: "business-onboarding",
    event: "business.created",
    status: "success",
    payload: { slug: business.slug },
  });
  return business;
}

export async function supabaseListBusinesses() {
  const supabase = getSupabaseServerClient();
  const result = await supabase.from("businesses").select("*").eq("status", "active").order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as BusinessDTO[];
}

export async function supabaseGetBusinessBySlug(slug: string) {
  const supabase = getSupabaseServerClient();
  const result = await supabase.from("businesses").select("*").eq("slug", slug).eq("status", "active").maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return (result.data as BusinessDTO | null) ?? null;
}

function matchesCatalog(product: ProductDTO, query: CatalogQuery) {
  if (query.featured && !product.featured) return false;
  if (query.inStock && (product.available_quantity ?? 0) <= 0) return false;
  const q = query.q?.trim().toLowerCase();
  if (!q) return true;
  return [product.name, product.description, product.category, ...product.tags].join(" ").toLowerCase().includes(q);
}

export async function supabaseGetStoreCatalog(businessId: string, query: CatalogQuery = {}) {
  const supabase = getSupabaseServerClient();
  await releaseExpiredReservations();
  let builder = supabase.from("products").select("*").eq("business_id", businessId).eq("status", "published");
  if (query.category) builder = builder.eq("category", query.category);
  if (query.featured) builder = builder.eq("featured", true);
  const result = await builder.order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  const products = await productsDTO((result.data ?? []) as Row[]);
  return products.filter((product) => matchesCatalog(product, query));
}

export async function supabaseGetStoreProduct(businessId: string, productId: string) {
  const supabase = getSupabaseServerClient();
  await releaseExpiredReservations();
  const result = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("business_id", businessId)
    .eq("status", "published")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) return null;
  return productDTO(productId);
}

export async function supabaseListBusinessProducts(user: SessionUser) {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  const result = await supabase.from("products").select("*").eq("business_id", business.id).order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return productsDTO((result.data ?? []) as Row[]);
}

export async function supabaseCreateProduct(user: SessionUser, input: CreateProductInput) {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  const existing = await supabase.from("products").select("slug").eq("business_id", business.id);
  if (existing.error) throw new Error(existing.error.message);
  const slug = uniqueSlug(input.name, (existing.data ?? []).map((item: Row) => item.slug));
  const productResult = await supabase
    .from("products")
    .insert({
      business_id: business.id,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() ?? "",
      category: input.category?.trim() ?? "",
      tags: input.tags ?? [],
      price: input.price,
      currency: input.currency ?? "BOB",
      status: input.status ?? "draft",
      featured: input.featured ?? false,
      ai_generated: input.ai_generated ?? false,
    })
    .select("*")
    .single();
  const product = unwrap(productResult) as Row;
  if (input.image_url) {
    await supabase.from("product_images").insert({
      product_id: product.id,
      storage_path: input.image_url,
      url: input.image_url,
      alt: product.name,
      sort_order: 0,
    });
  }
  await supabase.from("inventory").insert({
    business_id: business.id,
    product_id: product.id,
    quantity: input.initial_stock ?? 0,
    reserved_quantity: 0,
    low_stock_threshold: input.low_stock_threshold ?? 3,
  });
  for (const variant of input.variants ?? []) {
    await supabase.from("product_variants").insert({
      product_id: product.id,
      name: variant.name,
      sku: variant.sku ?? null,
      price_override: variant.price_override ?? null,
    });
  }
  await supabase.from("automation_logs").insert({
    business_id: business.id,
    workflow: "ai-product-creator",
    event: input.ai_generated ? "product.ai_draft_saved" : "product.created",
    status: "success",
    payload: { product_id: product.id, status: product.status },
  });
  return productDTO(product.id);
}

export async function supabaseUpdateProduct(user: SessionUser, productId: string, input: UpdateProductInput) {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  if (input.initial_stock !== undefined) {
    const inventoryCheck = await supabase
      .from("inventory")
      .select("reserved_quantity")
      .eq("product_id", productId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (inventoryCheck.error) throw new Error(inventoryCheck.error.message);
    if (inventoryCheck.data && Math.max(0, input.initial_stock) < Number(inventoryCheck.data.reserved_quantity)) {
      throw new Error("INSUFFICIENT_STOCK");
    }
  }
  const update: Row = { updated_at: now() };
  if (input.name) update.name = input.name.trim();
  if (input.description !== undefined) update.description = input.description.trim();
  if (input.category !== undefined) update.category = input.category.trim();
  if (input.tags) update.tags = input.tags;
  if (input.price !== undefined) update.price = input.price;
  if (input.currency) update.currency = input.currency;
  if (input.status) update.status = input.status;
  if (input.featured !== undefined) update.featured = input.featured;
  if (input.ai_generated !== undefined) update.ai_generated = input.ai_generated;
  const productResult = await supabase
    .from("products")
    .update(update)
    .eq("id", productId)
    .eq("business_id", business.id)
    .select("*")
    .single();
  const product = unwrap(productResult) as Row;
  if (input.image_url) {
    const images = await supabase.from("product_images").select("id").eq("product_id", product.id).limit(1);
    if (images.error) throw new Error(images.error.message);
    if (images.data?.[0]) {
      await supabase.from("product_images").update({ url: input.image_url, storage_path: input.image_url }).eq("id", images.data[0].id);
    } else {
      await supabase.from("product_images").insert({ product_id: product.id, storage_path: input.image_url, url: input.image_url, alt: product.name, sort_order: 0 });
    }
  }
  if (input.initial_stock !== undefined || input.low_stock_threshold !== undefined) {
    const existingInventory = await supabase
      .from("inventory")
      .select("*")
      .eq("product_id", product.id)
      .eq("business_id", business.id)
      .maybeSingle();
    if (existingInventory.error) throw new Error(existingInventory.error.message);
    const nextQuantity = input.initial_stock !== undefined ? Math.max(0, input.initial_stock) : undefined;
    if (existingInventory.data && nextQuantity !== undefined && nextQuantity < Number(existingInventory.data.reserved_quantity)) {
      throw new Error("INSUFFICIENT_STOCK");
    }
    if (existingInventory.data) {
      const inventoryUpdate: Row = { updated_at: now() };
      if (nextQuantity !== undefined) inventoryUpdate.quantity = nextQuantity;
      if (input.low_stock_threshold !== undefined) inventoryUpdate.low_stock_threshold = input.low_stock_threshold;
      const inventoryResult = await supabase
        .from("inventory")
        .update(inventoryUpdate)
        .eq("id", existingInventory.data.id)
        .select("*")
        .single();
      if (inventoryResult.error) throw new Error(inventoryResult.error.message);
    } else {
      const insertResult = await supabase.from("inventory").insert({
        business_id: business.id,
        product_id: product.id,
        quantity: nextQuantity ?? 0,
        reserved_quantity: 0,
        low_stock_threshold: input.low_stock_threshold ?? 3,
      });
      if (insertResult.error) throw new Error(insertResult.error.message);
    }
  }
  await supabase.from("automation_logs").insert({
    business_id: business.id,
    workflow: "product-management",
    event: "product.updated",
    status: "success",
    payload: { product_id: product.id, status: product.status },
  });
  return productDTO(product.id);
}

export async function supabaseGetInventory(user: SessionUser): Promise<InventoryDTO[]> {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  await releaseExpiredReservations();
  const [inventoryResult, productsResult] = await Promise.all([
    supabase.from("inventory").select("*").eq("business_id", business.id),
    supabase.from("products").select("id,name").eq("business_id", business.id),
  ]);
  if (inventoryResult.error) throw new Error(inventoryResult.error.message);
  if (productsResult.error) throw new Error(productsResult.error.message);
  const productNames = new Map((productsResult.data ?? []).map((product: Row) => [product.id, product.name]));
  return (inventoryResult.data ?? [])
    .map((item: Row) => {
      const available = Number(item.quantity) - Number(item.reserved_quantity);
      return {
        product_id: item.product_id,
        product_name: productNames.get(item.product_id) ?? "Producto",
        quantity: Number(item.quantity),
        reserved_quantity: Number(item.reserved_quantity),
        available_quantity: available,
        low_stock_threshold: Number(item.low_stock_threshold),
        low_stock: available <= Number(item.low_stock_threshold),
      };
    })
    .sort((a, b) => a.product_name.localeCompare(b.product_name));
}

export async function supabaseAdjustInventory(user: SessionUser, productId: string, delta: number, reason: string) {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  const rpc = await supabase.rpc("adjust_inventory", {
    p_business_id: business.id,
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
  });
  if (rpc.error) {
    const message = rpc.error.message ?? "INVENTORY_ADJUST_FAILED";
    if (message.includes("INSUFFICIENT_STOCK")) throw new Error("INSUFFICIENT_STOCK");
    if (message.includes("INVENTORY_NOT_FOUND")) throw new Error("INVENTORY_NOT_FOUND");
    throw new Error(message);
  }
  await supabase.from("automation_logs").insert({
    business_id: business.id,
    workflow: "inventory-automation",
    event: "inventory.adjusted",
    status: "success",
    payload: { product_id: productId, delta, reason },
  });
  return supabaseGetInventory(user);
}

export async function supabaseCreateOrder(input: CreateOrderInput) {
  const supabase = getSupabaseServerClient();
  const business = await supabase.from("businesses").select("id").eq("slug", input.business_slug).eq("status", "active").single();
  if (business.error || !business.data) throw new Error("BUSINESS_NOT_FOUND");
  await supabase.rpc("release_expired_reservations");
  const rpc = await supabase.rpc("create_order", {
    p_business_id: business.data.id,
    p_customer: input.customer,
    p_items: input.items,
    p_idempotency_key: input.idempotency_key,
    p_shipping_address: input.shipping_address ?? null,
    p_notes: input.notes ?? null,
  });
  if (rpc.error) {
    const message = rpc.error.message ?? "ORDER_FAILED";
    if (message.includes("INSUFFICIENT_STOCK")) throw new Error("INSUFFICIENT_STOCK");
    if (message.includes("PRODUCT_NOT_AVAILABLE")) throw new Error("PRODUCT_NOT_AVAILABLE");
    throw new Error(message);
  }
  const order = rpc.data as Row;
  return orderDTO(order.id);
}

export async function supabaseListOrders(user: SessionUser, status?: OrderStatusType) {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  await supabase.rpc("release_expired_reservations");
  let query = supabase.from("orders").select("id").eq("business_id", business.id).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const idsResult = await query;
  if (idsResult.error) throw new Error(idsResult.error.message);
  const ids = (idsResult.data ?? []).map((item: Row) => item.id);
  const orders = await Promise.all(ids.map((id: string) => orderDTO(id)));
  return orders;
}

export async function supabaseGetOrder(user: SessionUser, orderId: string) {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  const existing = await supabase.from("orders").select("id,business_id").eq("id", orderId).eq("business_id", business.id).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (!existing.data) throw new Error("ORDER_NOT_FOUND");
  return orderDTO(orderId);
}

export async function supabaseUpdateOrderStatus(user: SessionUser, orderId: string, status: OrderStatusType) {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  const existing = await supabase.from("orders").select("status,business_id").eq("id", orderId).single();
  if (existing.error || !existing.data || existing.data.business_id !== business.id) throw new Error("ORDER_NOT_FOUND");
  const rpc = await supabase.rpc("transition_order", { p_order_id: orderId, p_status: status });
  if (rpc.error) {
    if (rpc.error.message?.includes("INVALID")) throw new Error("INVALID_ORDER_TRANSITION");
    throw new Error(rpc.error.message ?? "ORDER_TRANSITION_FAILED");
  }
  return orderDTO(orderId);
}

export async function supabaseGetDashboardMetrics(user: SessionUser): Promise<DashboardMetrics> {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  await supabase.rpc("release_expired_reservations");
  const [ordersResult, productsResult, inventoryResult] = await Promise.all([
    supabase.from("orders").select("*").eq("business_id", business.id),
    supabase.from("products").select("*").eq("business_id", business.id),
    supabase.from("inventory").select("*").eq("business_id", business.id),
  ]);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (productsResult.error) throw new Error(productsResult.error.message);
  if (inventoryResult.error) throw new Error(inventoryResult.error.message);
  const orders = ordersResult.data ?? [];
  const products = productsResult.data ?? [];
  const inventory = inventoryResult.data ?? [];
  const orderIds = orders.map((order: Row) => order.id);
  const itemsResult = orderIds.length ? await supabase.from("order_items").select("*").in("order_id", orderIds) : { data: [], error: null };
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  const items = itemsResult.data ?? [];
  const confirmedStatuses: OrderStatusType[] = ["confirmed", "processing", "shipped", "delivered"];
  const pendingStatuses: OrderStatusType[] = ["pending", "awaiting_payment"];
  const confirmedRevenue = orders.filter((order: Row) => confirmedStatuses.includes(order.status)).reduce((sum: number, order: Row) => sum + Number(order.total), 0);
  const pendingRevenue = orders.filter((order: Row) => pendingStatuses.includes(order.status)).reduce((sum: number, order: Row) => sum + Number(order.total), 0);
  const sales = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of items) {
    const order = orders.find((candidate: Row) => candidate.id === item.order_id);
    if (!order || ["cancelled", "expired"].includes(order.status)) continue;
    const current = sales.get(item.product_id) ?? { name: item.product_name, quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += Number(item.unit_price) * item.quantity;
    sales.set(item.product_id, current);
  }
  const recentOrders = await Promise.all(
    orders.sort((a: Row, b: Row) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 8).map((order: Row) => orderDTO(order.id)),
  );
  const lowStock = inventory.filter((item: Row) => Number(item.quantity) - Number(item.reserved_quantity) <= Number(item.low_stock_threshold));
  const outOfStock = inventory.filter((item: Row) => Number(item.quantity) - Number(item.reserved_quantity) <= 0);
  return {
    business_id: business.id,
    currency: "BOB",
    confirmed_revenue: confirmedRevenue,
    pending_revenue: pendingRevenue,
    orders_total: orders.length,
    orders_pending: orders.filter((order: Row) => pendingStatuses.includes(order.status)).length,
    products_published: products.filter((product: Row) => product.status === "published").length,
    products_draft: products.filter((product: Row) => product.status === "draft").length,
    low_stock_count: lowStock.filter((item: Row) => Number(item.quantity) - Number(item.reserved_quantity) > 0).length,
    out_of_stock_count: outOfStock.length,
    top_products: [...sales.entries()].map(([product_id, value]) => ({ product_id, ...value })).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    recent_orders: recentOrders,
    recent_activity: recentOrders.slice(0, 5).map((order) => ({ id: order.id, label: `Pedido ${order.id.slice(0, 8)} · ${order.status}`, created_at: order.created_at })),
  };
}

export async function supabaseListLiveSessions(user: SessionUser) {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  const result = await supabase.from("live_sessions").select("*").eq("business_id", business.id).order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return Promise.all((result.data ?? []).map((session: Row) => liveSessionDTO(session.id)));
}

export async function supabaseCreateLiveSession(user: SessionUser, input: { title: string; description?: string; featured_product_ids?: string[] }) {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  const featuredIds = input.featured_product_ids ?? [];
  if (featuredIds.length) {
    const featuredResult = await supabase
      .from("products")
      .select("id")
      .in("id", featuredIds)
      .eq("business_id", business.id)
      .eq("status", "published");
    if (featuredResult.error) throw new Error(featuredResult.error.message);
    if ((featuredResult.data ?? []).length !== new Set(featuredIds).size) throw new Error("PRODUCT_NOT_AVAILABLE");
  }
  const result = await supabase
    .from("live_sessions")
    .insert({
      business_id: business.id,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      status: "scheduled",
      featured_product_ids: input.featured_product_ids ?? [],
    })
    .select("*")
    .single();
  const session = unwrap(result) as Row;
  await supabase.from("automation_logs").insert({ business_id: business.id, workflow: "live-sessions", event: "live.created", status: "success", payload: { live_session_id: session.id } });
  return liveSessionDTO(session.id);
}

export async function supabaseUpdateLiveSessionStatus(user: SessionUser, sessionId: string, status: "scheduled" | "live" | "ended") {
  const { business } = await requireBusinessForUser(user);
  const supabase = getSupabaseServerClient();
  const update: Row = { status };
  if (status === "live") update.started_at = now();
  if (status === "ended") update.ended_at = now();
  const result = await supabase.from("live_sessions").update(update).eq("id", sessionId).eq("business_id", business.id).select("*").single();
  const session = unwrap(result) as Row;
  await supabase.from("automation_logs").insert({ business_id: business.id, workflow: "live-sessions", event: `live.${status}`, status: "success", payload: { live_session_id: session.id } });
  return liveSessionDTO(session.id);
}

export async function supabaseAddLiveComment(input: { live_session_id: string; customer_name: string; message: string; product_id?: string | null }) {
  const supabase = getSupabaseServerClient();
  const sessionResult = await supabase.from("live_sessions").select("business_id").eq("id", input.live_session_id).single();
  if (sessionResult.error || !sessionResult.data) throw new Error("LIVE_SESSION_NOT_FOUND");
  if (input.product_id) {
    const productResult = await supabase
      .from("products")
      .select("id")
      .eq("id", input.product_id)
      .eq("business_id", sessionResult.data.business_id)
      .eq("status", "published")
      .maybeSingle();
    if (productResult.error) throw new Error(productResult.error.message);
    if (!productResult.data) throw new Error("PRODUCT_NOT_AVAILABLE");
  }
  const result = await supabase
    .from("live_comments")
    .insert({
      live_session_id: input.live_session_id,
      customer_name: input.customer_name.trim() || "Cliente",
      message: input.message.trim(),
      product_id: input.product_id ?? null,
    })
    .select("*")
    .single();
  const comment = unwrap(result) as Row;
  await supabase.from("automation_logs").insert({
    business_id: sessionResult.data.business_id,
    workflow: "live-interactions",
    event: "live.comment",
    status: "success",
    payload: { live_session_id: input.live_session_id, product_id: comment.product_id },
  });
  return comment;
}

export async function supabaseListLiveComments(liveSessionId: string): Promise<LiveCommentDTO[]> {
  const supabase = getSupabaseServerClient();
  const result = await supabase.from("live_comments").select("*").eq("live_session_id", liveSessionId).order("created_at", { ascending: true });
  if (result.error) throw new Error(result.error.message);
  const comments = result.data ?? [];
  const sessionResult = await supabase.from("live_sessions").select("business_id").eq("id", liveSessionId).maybeSingle();
  if (sessionResult.error) throw new Error(sessionResult.error.message);
  const productIds = [...new Set(comments.map((comment: Row) => comment.product_id).filter(Boolean))];
  const productsResult = productIds.length && sessionResult.data?.business_id
    ? await supabase.from("products").select("id,name").in("id", productIds).eq("business_id", sessionResult.data.business_id).eq("status", "published")
    : { data: [], error: null };
  if (productsResult.error) throw new Error(productsResult.error.message);
  const names = new Map((productsResult.data ?? []).map((product: Row) => [product.id, product.name]));
  return comments.map((comment: Row) => ({ ...comment, product_name: comment.product_id ? names.get(comment.product_id) ?? null : null })) as LiveCommentDTO[];
}

export async function supabaseGetLiveSessionById(sessionId: string) {
  try {
    return await liveSessionDTO(sessionId);
  } catch {
    return null;
  }
}

export async function supabaseGetAssistantCatalog(businessId: string): Promise<AssistantCatalogItem[]> {
  const products = await supabaseGetStoreCatalog(businessId, {});
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

export async function supabaseGetAnalyticsReport(user: SessionUser, days = 30): Promise<AnalyticsReport> {
  const metrics = await supabaseGetDashboardMetrics(user);
  const recommendations: string[] = [];
  if (metrics.low_stock_count > 0) recommendations.push("Reponer stock bajo antes del próximo LIVE para evitar ventas perdidas.");
  if (metrics.pending_revenue > 0) recommendations.push("Hacer seguimiento a pedidos pendientes para moverlos a confirmados.");
  if (metrics.top_products.length > 0) recommendations.push(`Impulsar ${metrics.top_products[0].name} en la próxima transmisión LIVE.`);
  if (metrics.products_draft > 0) recommendations.push("Publicar borradores con IA para mantener el catálogo fresco.");
  if (recommendations.length === 0) recommendations.push("Publicar productos y crear una sesión LIVE para activar recomendaciones.");
  const narrative = `En los últimos ${days} días, el negocio registró ${metrics.orders_total} pedidos, ${metrics.orders_pending} pendientes y ${new Intl.NumberFormat("es-BO", { style: "currency", currency: metrics.currency, maximumFractionDigits: 0 }).format(metrics.confirmed_revenue)} en ventas confirmadas. ${metrics.top_products[0] ? `El producto más vendido es ${metrics.top_products[0].name}.` : "Aún no hay productos vendidos."}`;
  return {
    business_id: metrics.business_id,
    generated_at: now(),
    period_days: days,
    metrics,
    recommendations,
    narrative,
  };
}

export async function supabaseListPublicLiveSessions(businessId: string) {
  await releaseExpiredReservations();
  const { data, error } = await getSupabaseServerClient()
    .from("live_sessions")
    .select("*")
    .eq("business_id", businessId)
    .in("status", ["live", "scheduled"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const sessions = await Promise.all((data ?? []).map((session: Row) => liveSessionDTO(session.id)));
  return sessions as LiveSessionDTO[];
}

export async function supabaseGetBusinessById(businessId: string) {
  const result = await getSupabaseServerClient().from("businesses").select("*").eq("id", businessId).eq("status", "active").maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return (result.data as BusinessDTO | null) ?? null;
}
