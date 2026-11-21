import { apiError, json, parseJson, requireApiUser, requireBusiness } from "@/lib/api";
import { createLiveSession, listLiveSessions } from "@/lib/data";
import { liveSessionSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireApiUser();
    await requireBusiness(user);
    return json({ sessions: await listLiveSessions(user) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    await requireBusiness(user);
    const input = await parseJson(request, liveSessionSchema);
    return json({ session: await createLiveSession(user, input) }, 201);
  } catch (error) {
    return apiError(error);
  }
}
