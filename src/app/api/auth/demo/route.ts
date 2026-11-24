import { apiError, json, parseJson } from "@/lib/api";
import { DEMO_SESSION_COOKIE } from "@/lib/auth";
import { getDemoDb } from "@/lib/demo/store";
import { demoAuthSchema } from "@/lib/validation";
import { cookies } from "next/headers";

function now() {
  return new Date().toISOString();
}

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, demoAuthSchema);
    const db = getDemoDb();
    let profile = db.profiles.find((item) => item.email.toLowerCase() === input.email.toLowerCase() && item.role === input.role);
    if (!profile) {
      profile = {
        id: crypto.randomUUID(),
        clerk_user_id: `demo-${input.role}-${input.email.toLowerCase()}`,
        email: input.email.toLowerCase(),
        full_name: input.full_name,
        role: input.role,
        created_at: now(),
      };
      db.profiles.push(profile);
    } else {
      profile.full_name = input.full_name;
    }
    const cookieStore = await cookies();
    cookieStore.set(DEMO_SESSION_COOKIE, profile.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return json({ user: { id: profile.id, email: profile.email, full_name: profile.full_name, role: profile.role, auth_mode: "demo" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);
  return json({ ok: true });
}
