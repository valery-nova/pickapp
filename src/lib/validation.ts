import { z } from "zod";

export const businessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(120).optional(),
  contact_email: z.string().trim().email().optional().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional(),
  logo_url: z.string().trim().url().optional().or(z.literal("")),
  cover_url: z.string().trim().url().optional().or(z.literal("")),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  category: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  price: z.coerce.number().nonnegative().max(1000000),
  currency: z.string().trim().length(3).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  featured: z.boolean().optional(),
  ai_generated: z.boolean().optional(),
  image_url: z.string().trim().url().optional().or(z.literal("")),
  initial_stock: z.coerce.number().int().nonnegative().max(1000000).optional(),
  low_stock_threshold: z.coerce.number().int().nonnegative().max(1000000).optional(),
  variants: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        sku: z.string().trim().max(80).optional(),
        price_override: z.coerce.number().nonnegative().optional(),
      }),
    )
    .max(50)
    .optional(),
});

export const productUpdateSchema = productSchema.partial();

export const orderItemSchema = z.object({
  product_id: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive().max(1000),
});

export const orderSchema = z.object({
  business_slug: z.string().trim().min(1),
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional(),
    clerk_user_id: z.string().trim().optional(),
  }),
  items: z.array(orderItemSchema).min(1).max(100),
  idempotency_key: z.string().trim().min(8).max(120),
  shipping_address: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const orderStatusSchema = z.enum([
  "pending",
  "awaiting_payment",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "expired",
]);

export const liveSessionSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  featured_product_ids: z.array(z.string().trim().min(1)).max(50).optional(),
});

export const liveCommentSchema = z.object({
  customer_name: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(1000),
  product_id: z.string().trim().min(1).optional().nullable(),
});

export const assistantMessageSchema = z.object({
  business_slug: z.string().trim().min(1),
  conversation_id: z.string().trim().optional(),
  customer_name: z.string().trim().max(80).optional(),
  message: z.string().trim().min(1).max(2000),
  customer_email: z.string().trim().email().optional().or(z.literal("")),
});

export const demoAuthSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(["entrepreneur", "customer"]),
});

export const inventoryAdjustSchema = z.object({
  product_id: z.string().trim().min(1),
  delta: z.coerce.number().int().refine((value) => value !== 0, "delta must not be 0"),
  reason: z.string().trim().min(1).max(120).default("manual_adjustment"),
});

export type BusinessInput = z.infer<typeof businessSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type DemoAuthInput = z.infer<typeof demoAuthSchema>;
export type AssistantMessageInput = z.infer<typeof assistantMessageSchema>;
