import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getDemoDb } from "@/lib/demo/store";
import type { SessionUser, UserRole } from "@/lib/types";

export const DEMO_SESSION_COOKIE = "pickapp_demo_session";

function roleFromMetadata(value: unknown): UserRole {
  return value === "entrepreneur" ? "entrepreneur" : "customer";
}

async function getClerkSessionUser(): Promise<SessionUser | null> {
  if (!env.clerkSecretKey || !env.clerkPublishableKey) return null;
  const [{ auth }, { currentUser }] = await Promise.all([
    import("@clerk/nextjs/server"),
    import("@clerk/nextjs/server"),
  ]);
  const session = await auth();
  if (!session.userId) return null;
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "";
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    email ||
    "Usuario PICKAPP";
  const metadataRole = roleFromMetadata(user?.unsafeMetadata?.role);
  return {
    id: session.userId,
    clerk_user_id: session.userId,
    email,
    full_name: fullName,
    role: metadataRole,
    auth_mode: "clerk",
  };
}

async function getDemoSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const profileId = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  if (!profileId) return null;
  const profile = getDemoDb().profiles.find((item) => item.id === profileId);
  if (!profile) return null;
  return {
    id: profile.id,
    clerk_user_id: profile.clerk_user_id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    auth_mode: "demo",
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (env.authMode === "clerk") {
    try {
      return await getClerkSessionUser();
    } catch {
      return null;
    }
  }
  return getDemoSessionUser();
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
