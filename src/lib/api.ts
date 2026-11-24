import "server-only";
import type { z } from "zod";
import { getSessionUser, requireSessionUser } from "@/lib/auth";
import { getBusinessForUser } from "@/lib/data";
import type { BusinessDTO } from "@/lib/data/contracts";
import type { SessionUser } from "@/lib/types";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function apiError(error: unknown, fallbackStatus = 500) {
  const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
  const statusMap: Record<string, number> = {
    UNAUTHENTICATED: 401,
    BUSINESS_NOT_FOUND: 404,
    PRODUCT_NOT_FOUND: 404,
    ORDER_NOT_FOUND: 404,
    LIVE_SESSION_NOT_FOUND: 404,
    PRODUCT_NOT_AVAILABLE: 409,
    INSUFFICIENT_STOCK: 409,
    INVALID_ORDER_TRANSITION: 409,
    ORDER_EMPTY: 400,
    LLM_API_KEY_MISSING: 503,
    N8N_BASE_URL_MISSING: 503,
    AI_INVALID_JSON: 502,
  };
  const status = statusMap[message] ?? fallbackStatus;
  return json({ error: message }, status);
}

export async function requireApiUser(): Promise<SessionUser> {
  return requireSessionUser();
}

export async function optionalApiUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export async function requireBusiness(user: SessionUser): Promise<BusinessDTO> {
  const business = await getBusinessForUser(user);
  if (!business) throw new Error("BUSINESS_NOT_FOUND");
  return business;
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("INVALID_JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`VALIDATION_ERROR:${parsed.error.issues.map((issue) => issue.path.join(".")).join(",")}`);
  }
  return parsed.data;
}
