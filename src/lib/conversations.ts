import "server-only";
import { env } from "@/lib/env";
import { getDemoDb } from "@/lib/demo/store";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ConversationChannel, MessageRole } from "@/lib/types";

function now() {
  return new Date().toISOString();
}

export async function appendAssistantExchange(input: {
  businessId: string;
  conversationId?: string;
  customerName?: string;
  customerEmail?: string;
  clerkUserId?: string;
  channel?: ConversationChannel;
  userMessage: string;
  assistantReply: string;
  referencedProductIds?: string[];
}): Promise<{ conversationId: string; userMessageId: string; assistantMessageId: string }> {
  if (env.dataMode === "supabase") {
    const supabase = getSupabaseServerClient();
    let customerId: string | null = null;
    if (input.clerkUserId || input.customerEmail) {
      let query = supabase.from("customers").select("id").eq("business_id", input.businessId);
      query = input.clerkUserId ? query.eq("clerk_user_id", input.clerkUserId) : query.eq("email", input.customerEmail ?? "");
      const { data: customer } = await query.limit(1).maybeSingle();
      customerId = customer?.id ?? null;
    }
    if (!customerId && (input.customerName || input.customerEmail)) {
      const { data: customer, error } = await supabase
        .from("customers")
        .insert({
          business_id: input.businessId,
          clerk_user_id: input.clerkUserId ?? null,
          name: input.customerName ?? "Cliente",
          email: input.customerEmail || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      customerId = customer.id;
    }
    let conversationId = input.conversationId;
    if (!conversationId) {
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({ business_id: input.businessId, customer_id: customerId, channel: input.channel ?? "assistant", status: "open" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      conversationId = conversation.id;
    }
    if (!conversationId) throw new Error("CONVERSATION_NOT_FOUND");
    const { data: userMessage, error: userError } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, role: "customer", content: input.userMessage })
      .select("id")
      .single();
    if (userError) throw new Error(userError.message);
    const { data: assistantMessage, error: assistantError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: input.assistantReply,
        metadata: { referenced_product_ids: input.referencedProductIds ?? [] },
      })
      .select("id")
      .single();
    if (assistantError) throw new Error(assistantError.message);
    await supabase.from("conversations").update({ updated_at: now() }).eq("id", conversationId);
    return { conversationId, userMessageId: userMessage.id, assistantMessageId: assistantMessage.id };
  }

  const db = getDemoDb();
  let customer = db.customers.find(
    (item) =>
      item.business_id === input.businessId &&
      ((input.clerkUserId && item.clerk_user_id === input.clerkUserId) || (input.customerEmail && item.email === input.customerEmail)),
  );
  if (!customer && (input.customerName || input.customerEmail)) {
    customer = {
      id: crypto.randomUUID(),
      business_id: input.businessId,
      clerk_user_id: input.clerkUserId ?? null,
      name: input.customerName ?? "Cliente",
      email: input.customerEmail || null,
      phone: null,
      created_at: now(),
    };
    db.customers.push(customer);
  }
  let conversation = input.conversationId
    ? db.conversations.find((item) => item.id === input.conversationId && item.business_id === input.businessId)
    : undefined;
  if (!conversation) {
    conversation = {
      id: crypto.randomUUID(),
      business_id: input.businessId,
      customer_id: customer?.id ?? null,
      channel: input.channel ?? "assistant",
      status: "open",
      created_at: now(),
      updated_at: now(),
    };
    db.conversations.push(conversation);
  }
  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
  const timestamp = now();
  const userMessage = { id: crypto.randomUUID(), conversation_id: conversation.id, role: "customer" as MessageRole, content: input.userMessage, product_id: null, metadata: {}, created_at: timestamp };
  const assistantMessage = {
    id: crypto.randomUUID(),
    conversation_id: conversation.id,
    role: "assistant" as MessageRole,
    content: input.assistantReply,
    product_id: input.referencedProductIds?.[0] ?? null,
    metadata: { referenced_product_ids: input.referencedProductIds ?? [] },
    created_at: timestamp,
  };
  db.messages.push(userMessage, assistantMessage);
  conversation.updated_at = timestamp;
  return { conversationId: conversation.id, userMessageId: userMessage.id, assistantMessageId: assistantMessage.id };
}

export async function listConversationMessages(conversationId: string) {
  if (env.dataMode === "supabase") {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("messages").select("id,role,content,product_id,created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  return getDemoDb().messages.filter((message) => message.conversation_id === conversationId).slice(-50);
}
