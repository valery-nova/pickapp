import { apiError, json, requireApiUser, requireBusiness } from "@/lib/api";
import { generateProductDraft } from "@/lib/ai";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const business = await requireBusiness(user);
    const form = await request.formData();
    const file = form.get("file");
    const description = String(form.get("description") ?? "");
    if (!(file instanceof File)) return json({ error: "FILE_REQUIRED" }, 400);
    if (!file.type.startsWith("image/")) return json({ error: "INVALID_FILE_TYPE" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "FILE_TOO_LARGE" }, 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageDataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
    const draft = await generateProductDraft({
      imageDataUrl,
      fileName: file.name,
      description,
      businessCategory: business.category ?? undefined,
    });
    return json({ draft });
  } catch (error) {
    return apiError(error);
  }
}
