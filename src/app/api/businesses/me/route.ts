import { json } from "@/lib/api";
import { getBusinessForUser } from "@/lib/data";
import { requireApiUser } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireApiUser();
    return json({ business: await getBusinessForUser(user) });
  } catch (error) {
    return json({ business: null, error: error instanceof Error ? error.message : "ERROR" }, 200);
  }
}
