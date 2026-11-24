import { apiError, json, optionalApiUser, parseJson } from "@/lib/api";
import { generateAssistantReply } from "@/lib/ai";
import { getAssistantCatalog, getBusinessBySlug } from "@/lib/data";
import { appendAssistantExchange, assertConversationInBusiness, listConversationMessages } from "@/lib/conversations";
import { assistantMessageSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await optionalApiUser();
    const input = await parseJson(request, assistantMessageSchema);
    const business = await getBusinessBySlug(input.business_slug);
    if (!business) return json({ error: "BUSINESS_NOT_FOUND" }, 404);
    if (input.conversation_id) await assertConversationInBusiness(input.conversation_id, business.id);
    const [catalog, history] = await Promise.all([
      getAssistantCatalog(business.id),
      input.conversation_id ? listConversationMessages(input.conversation_id) : Promise.resolve([]),
    ]);
    const reply = await generateAssistantReply({
      business,
      catalog,
      history: history.map((message) => ({ role: message.role === "assistant" ? "assistant" : "customer", content: message.content })),
      message: input.message,
      customerName: input.customer_name,
    });
    const saved = await appendAssistantExchange({
      businessId: business.id,
      conversationId: input.conversation_id,
      customerName: input.customer_name || user?.full_name,
      customerEmail: input.customer_email || user?.email,
      clerkUserId: user?.clerk_user_id ?? undefined,
      channel: "assistant",
      userMessage: input.message,
      assistantReply: reply.reply,
      referencedProductIds: reply.referenced_product_ids,
    });
    return json({
      conversation_id: saved.conversationId,
      reply: reply.reply,
      intent: reply.intent,
      referenced_product_ids: reply.referenced_product_ids,
      provider: reply.provider,
      model: reply.model ?? null,
    });
  } catch (error) {
    return apiError(error);
  }
}
