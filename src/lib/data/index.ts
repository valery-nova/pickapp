import "server-only";
import { env } from "@/lib/env";
import type { SessionUser } from "@/lib/types";
import * as demo from "./demo";
import * as supabase from "./supabase";
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
import type { OrderStatus } from "@/lib/types";

const useSupabase = env.dataMode === "supabase";

export async function ensureProfile(user: SessionUser) {
  return useSupabase ? supabase.supabaseEnsureProfile(user) : demo.demoEnsureProfile(user);
}

export async function getBusinessForUser(user: SessionUser): Promise<BusinessDTO | null> {
  return useSupabase ? supabase.supabaseGetBusinessForUser(user) : demo.demoGetBusinessForUser(user);
}

export async function createBusiness(user: SessionUser, input: CreateBusinessInput) {
  return useSupabase ? supabase.supabaseCreateBusiness(user, input) : demo.demoCreateBusiness(user, input);
}

export async function listBusinesses() {
  return useSupabase ? supabase.supabaseListBusinesses() : demo.demoListBusinesses();
}

export async function getBusinessBySlug(slug: string) {
  return useSupabase ? supabase.supabaseGetBusinessBySlug(slug) : demo.demoGetBusinessBySlug(slug);
}

export async function getStoreCatalog(businessId: string, query: CatalogQuery = {}): Promise<ProductDTO[]> {
  return useSupabase ? supabase.supabaseGetStoreCatalog(businessId, query) : demo.demoGetStoreCatalog(businessId, query);
}

export async function getStoreProduct(businessId: string, productId: string): Promise<ProductDTO | null> {
  return useSupabase ? supabase.supabaseGetStoreProduct(businessId, productId) : demo.demoGetStoreProduct(businessId, productId);
}

export async function listBusinessProducts(user: SessionUser): Promise<ProductDTO[]> {
  return useSupabase ? supabase.supabaseListBusinessProducts(user) : demo.demoListBusinessProducts(user);
}

export async function createProduct(user: SessionUser, input: CreateProductInput) {
  return useSupabase ? supabase.supabaseCreateProduct(user, input) : demo.demoCreateProduct(user, input);
}

export async function updateProduct(user: SessionUser, productId: string, input: UpdateProductInput) {
  return useSupabase ? supabase.supabaseUpdateProduct(user, productId, input) : demo.demoUpdateProduct(user, productId, input);
}

export async function getInventory(user: SessionUser): Promise<InventoryDTO[]> {
  return useSupabase ? supabase.supabaseGetInventory(user) : demo.demoGetInventory(user);
}

export async function adjustInventory(user: SessionUser, productId: string, delta: number, reason: string) {
  return useSupabase ? supabase.supabaseAdjustInventory(user, productId, delta, reason) : demo.demoAdjustInventory(user, productId, delta, reason);
}

export async function createOrder(input: CreateOrderInput): Promise<OrderDTO> {
  return useSupabase ? supabase.supabaseCreateOrder(input) : demo.demoCreateOrder(input);
}

export async function listOrders(user: SessionUser, status?: OrderStatus): Promise<OrderDTO[]> {
  return useSupabase ? supabase.supabaseListOrders(user, status) : demo.demoListOrders(user, status);
}

export async function updateOrderStatus(user: SessionUser, orderId: string, status: OrderStatus): Promise<OrderDTO> {
  return useSupabase ? supabase.supabaseUpdateOrderStatus(user, orderId, status) : demo.demoUpdateOrderStatus(user, orderId, status);
}

export async function getDashboardMetrics(user: SessionUser): Promise<DashboardMetrics> {
  return useSupabase ? supabase.supabaseGetDashboardMetrics(user) : demo.demoGetDashboardMetrics(user);
}

export async function listLiveSessions(user: SessionUser): Promise<LiveSessionDTO[]> {
  return useSupabase ? supabase.supabaseListLiveSessions(user) : demo.demoListLiveSessions(user);
}

export async function createLiveSession(user: SessionUser, input: { title: string; description?: string; featured_product_ids?: string[] }) {
  return useSupabase ? supabase.supabaseCreateLiveSession(user, input) : demo.demoCreateLiveSession(user, input);
}

export async function updateLiveSessionStatus(user: SessionUser, sessionId: string, status: "scheduled" | "live" | "ended") {
  return useSupabase ? supabase.supabaseUpdateLiveSessionStatus(user, sessionId, status) : demo.demoUpdateLiveSessionStatus(user, sessionId, status);
}

export async function addLiveComment(input: { live_session_id: string; customer_name: string; message: string; product_id?: string | null }) {
  return useSupabase ? supabase.supabaseAddLiveComment(input) : demo.demoAddLiveComment(input);
}

export async function listLiveComments(liveSessionId: string): Promise<LiveCommentDTO[]> {
  return useSupabase ? supabase.supabaseListLiveComments(liveSessionId) : demo.demoListLiveComments(liveSessionId);
}

export async function getLiveSessionById(sessionId: string): Promise<LiveSessionDTO | null> {
  return useSupabase ? supabase.supabaseGetLiveSessionById(sessionId) : demo.demoGetLiveSessionById(sessionId);
}

export async function getAssistantCatalog(businessId: string): Promise<AssistantCatalogItem[]> {
  return useSupabase ? supabase.supabaseGetAssistantCatalog(businessId) : demo.demoGetAssistantCatalog(businessId);
}

export async function getAnalyticsReport(user: SessionUser, days = 30): Promise<AnalyticsReport> {
  return useSupabase ? supabase.supabaseGetAnalyticsReport(user, days) : demo.demoGetAnalyticsReport(user, days);
}

export async function listPublicLiveSessions(businessId: string): Promise<LiveSessionDTO[]> {
  return useSupabase ? supabase.supabaseListPublicLiveSessions(businessId) : demo.demoListPublicLiveSessions(businessId);
}

export async function getBusinessById(businessId: string): Promise<BusinessDTO | null> {
  return useSupabase ? supabase.supabaseGetBusinessById(businessId) : demo.demoGetBusinessById(businessId);
}
