import { apiError, json, requireApiUser } from "@/lib/api";
import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import crypto from "node:crypto";

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "product-images";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "FILE_REQUIRED" }, 400);
    if (!file.type.startsWith("image/")) return json({ error: "INVALID_FILE_TYPE" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "FILE_TOO_LARGE" }, 400);

    if (env.dataMode === "supabase") {
      const supabase = getSupabaseServerClient();
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return json({ url: data.publicUrl, provider: "supabase-storage" });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    return json({ url: `data:${file.type};base64,${buffer.toString("base64")}`, provider: "demo-data-url" });
  } catch (error) {
    return apiError(error);
  }
}
