import { apiError, json, parseJson } from "@/lib/api";
import { addLiveComment, listLiveComments } from "@/lib/data";
import { liveCommentSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    return json({ comments: await listLiveComments(id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await parseJson(request, liveCommentSchema);
    return json({ comment: await addLiveComment({ ...body, live_session_id: id }) }, 201);
  } catch (error) {
    return apiError(error);
  }
}
