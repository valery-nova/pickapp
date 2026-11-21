import "server-only";

const hasClerk = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  dataMode:
    process.env.PICKAPP_DATA_MODE === "supabase" ||
    (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
      ? "supabase"
      : "demo",
  authMode:
    process.env.PICKAPP_AUTH_MODE === "clerk" ||
    (process.env.PICKAPP_AUTH_MODE !== "demo" && hasClerk)
      ? "clerk"
      : "demo",
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  clerkSecretKey: process.env.CLERK_SECRET_KEY,
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET,
  n8nBaseUrl: process.env.N8N_BASE_URL,
  llmProvider: process.env.PICKAPP_LLM_PROVIDER ?? "openai",
  llmModel: process.env.PICKAPP_LLM_MODEL ?? "gpt-4o-mini",
  llmApiKey:
    process.env.OPENAI_API_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.PICKAPP_LLM_API_KEY,
  demoSeed: process.env.PICKAPP_DEMO_SEED !== "false",
} as const;

export function requireSupabaseEnv() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error("Supabase env vars are not configured");
  }
  return { url: env.supabaseUrl, key: env.supabaseServiceKey };
}
