import { json } from "@/lib/api";
import { env } from "@/lib/env";

export function GET() {
  return json({
    ok: true,
    service: "pickapp",
    dataMode: env.dataMode,
    authMode: env.authMode,
    llmConfigured: Boolean(env.llmApiKey),
    n8nConfigured: Boolean(env.n8nBaseUrl),
  });
}
