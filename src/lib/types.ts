export type UserRole = "entrepreneur" | "customer";
export type BusinessStatus = "active" | "paused" | "archived";
export type ProductStatus = "draft" | "published" | "archived";
export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "expired";
export type LiveStatus = "scheduled" | "live" | "ended";
export type ReservationStatus = "active" | "consumed" | "released" | "expired";
export type MessageRole = "customer" | "assistant" | "entrepreneur";
export type ConversationChannel = "store" | "live" | "assistant";

export interface Profile {
  id: string;
  clerk_user_id: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface Business {
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
  updated_at: string;
}

export interface Product {
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
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  url: string;
  alt: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price_override: number | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  business_id: string;
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  business_id: string;
  product_id: string;
  delta: number;
  reason: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface InventoryReservation {
  id: string;
  business_id: string;
  product_id: string;
  order_id: string | null;
  quantity: number;
  status: ReservationStatus;
  expires_at: string;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  clerk_user_id: string | null;
  created_at: string;
}

export interface Order {
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
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  paid_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface LiveSession {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  status: LiveStatus;
  featured_product_ids: string[];
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface LiveComment {
  id: string;
  live_session_id: string;
  customer_name: string;
  message: string;
  product_id: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  business_id: string;
  customer_id: string | null;
  channel: ConversationChannel;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  product_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SalesInsight {
  id: string;
  business_id: string;
  type: string;
  payload: Record<string, unknown>;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface AutomationLog {
  id: string;
  business_id: string | null;
  workflow: string;
  event: string;
  status: "success" | "failed" | "skipped";
  payload: Record<string, unknown>;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  business_id: string;
  channel: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: string;
}

export interface DemoDb {
  profiles: Profile[];
  businesses: Business[];
  products: Product[];
  productImages: ProductImage[];
  productVariants: ProductVariant[];
  inventory: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  inventoryReservations: InventoryReservation[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
  liveSessions: LiveSession[];
  liveComments: LiveComment[];
  conversations: Conversation[];
  messages: Message[];
  salesInsights: SalesInsight[];
  automationLogs: AutomationLog[];
  notificationPreferences: NotificationPreference[];
}

export interface SessionUser {
  id: string;
  clerk_user_id: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  auth_mode: "clerk" | "demo";
}
