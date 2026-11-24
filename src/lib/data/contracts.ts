import type {
  BusinessStatus,
  LiveStatus,
  OrderStatus,
  ProductStatus,
  UserRole,
} from "@/lib/types";

export interface ProfileDTO {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

export interface BusinessDTO {
  id: string;
  owner_profile_id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  logo_url: string | null;
  cover_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: BusinessStatus;
  created_at: string;
}

export interface ProductImageDTO {
  id: string;
  url: string;
  alt: string | null;
  sort_order: number;
}

export interface ProductVariantDTO {
  id: string;
  name: string;
  sku: string | null;
  price_override: number | null;
}

export interface ProductDTO {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
  currency: string;
  status: ProductStatus;
  featured: boolean;
  ai_generated: boolean;
  image_url: string | null;
  images: ProductImageDTO[];
  variants: ProductVariantDTO[];
  available_quantity: number | null;
  reserved_quantity: number | null;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
}

export interface CatalogQuery {
  q?: string;
  category?: string;
  inStock?: boolean;
  featured?: boolean;
}

export interface CreateBusinessInput {
  name: string;
  description?: string;
  category?: string;
  contact_email?: string;
  contact_phone?: string;
  logo_url?: string;
  cover_url?: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  price: number;
  currency?: string;
  status?: ProductStatus;
  featured?: boolean;
  ai_generated?: boolean;
  image_url?: string;
  initial_stock?: number;
  low_stock_threshold?: number;
  variants?: Array<{ name: string; sku?: string; price_override?: number }>;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  status?: ProductStatus;
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
}

export interface CustomerInput {
  name: string;
  email?: string;
  phone?: string;
  clerk_user_id?: string;
}

export interface CreateOrderInput {
  business_slug: string;
  customer: CustomerInput;
  items: OrderItemInput[];
  idempotency_key: string;
  shipping_address?: Record<string, unknown>;
  notes?: string;
}

export interface OrderItemDTO {
  id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface OrderDTO {
  id: string;
  business_id: string;
  customer_id: string | null;
  status: OrderStatus;
  subtotal: number;
  total: number;
  currency: string;
  idempotency_key: string;
  shipping_address: Record<string, unknown> | null;
  notes: string | null;
  customer_name: string | null;
  customer_email: string | null;
  items: OrderItemDTO[];
  created_at: string;
  updated_at: string;
}

export interface InventoryDTO {
  product_id: string;
  product_name: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  low_stock_threshold: number;
  low_stock: boolean;
}

export interface LiveSessionDTO {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  status: LiveStatus;
  featured_product_ids: string[];
  featured_products: ProductDTO[];
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface LiveCommentDTO {
  id: string;
  live_session_id: string;
  customer_name: string;
  message: string;
  product_id: string | null;
  product_name: string | null;
  created_at: string;
}

export interface DashboardMetrics {
  business_id: string;
  currency: string;
  confirmed_revenue: number;
  pending_revenue: number;
  orders_total: number;
  orders_pending: number;
  products_published: number;
  products_draft: number;
  low_stock_count: number;
  out_of_stock_count: number;
  top_products: Array<{ product_id: string; name: string; quantity: number; revenue: number }>;
  recent_orders: OrderDTO[];
  recent_activity: Array<{ id: string; label: string; created_at: string }>;
}

export interface AssistantCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
  currency: string;
  available_quantity: number;
  variants: ProductVariantDTO[];
}

export interface AnalyticsReport {
  business_id: string;
  generated_at: string;
  period_days: number;
  metrics: DashboardMetrics;
  recommendations: string[];
  narrative: string;
}
