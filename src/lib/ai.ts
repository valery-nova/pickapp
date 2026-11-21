import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import type { AssistantCatalogItem, BusinessDTO } from "@/lib/data/contracts";

const productDraftSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().min(10).max(4000),
  category: z.string().min(1).max(120),
  tags: z.array(z.string().min(1).max(40)).max(20),
  visible_features: z.array(z.string().max(160)).max(12),
  promotional_text: z.string().max(1000),
  suggested_price: z.number().nonnegative().nullable(),
  confidence: z.preprocess((value) => {
    const text = String(value ?? "").toLowerCase();
    if (text.includes("high")) return "high";
    if (text.includes("medium")) return "medium";
    return "low";
  }, z.enum(["low", "medium", "high"])),
  warnings: z.array(z.string().max(240)).max(10),
});

export type ProductDraft = z.infer<typeof productDraftSchema> & {
  provider: "n8n" | "llm" | "demo-fallback";
  model?: string;
};

const assistantReplySchema = z.object({
  reply: z.string().min(1).max(4000),
  intent: z.object({
    type: z.enum(["none", "product_question", "order_intent", "handoff"]),
    product_id: z.string().nullable(),
    quantity: z.number().int().positive().nullable(),
    confidence: z.number().min(0).max(1),
  }),
  referenced_product_ids: z.array(z.string()).max(10),
});

export type AssistantReply = z.infer<typeof assistantReplySchema> & {
  provider: "n8n" | "llm" | "demo-fallback";
  model?: string;
};

function cleanJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI_INVALID_JSON");
  return JSON.parse(match[0]);
}

async function callOpenAiCompatible({
  system,
  user,
  imageDataUrl,
  model,
}: {
  system: string;
  user: string;
  imageDataUrl?: string;
  model: string;
}) {
  if (!env.llmApiKey) throw new Error("LLM_API_KEY_MISSING");
  const baseUrl = process.env.PICKAPP_LLM_BASE_URL ?? "https://api.openai.com/v1";
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [{ type: "text", text: user }];
  if (imageDataUrl) {
    content.push({ type: "image_url", image_url: { url: imageDataUrl } });
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.llmApiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM_REQUEST_FAILED:${response.status}:${body.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("LLM_EMPTY_RESPONSE");
  return { text, model: data?.model ?? model };
}

async function callN8nWebhook(path: string, payload: Record<string, unknown>) {
  if (!env.n8nBaseUrl) throw new Error("N8N_BASE_URL_MISSING");
  const url = new URL(path, env.n8nBaseUrl).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.n8nWebhookSecret ? { "x-pickapp-webhook-secret": env.n8nWebhookSecret } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`N8N_REQUEST_FAILED:${response.status}:${body.slice(0, 200)}`);
  }
  return response.json();
}

export async function generateProductDraft(input: {
  imageDataUrl?: string;
  fileName?: string;
  description?: string;
  businessCategory?: string;
}): Promise<ProductDraft> {
  const system = `Eres un asistente de comercio para PICKAPP. Genera una ficha comercial en JSON válido.
Reglas estrictas: no inventes materiales, tallas, marcas, precios ni características técnicas no visibles.
Si no puedes verificar un dato, inclúyelo en warnings y usa suggested_price=null.
Devuelve solo JSON con: name, description, category, tags, visible_features, promotional_text, suggested_price, confidence, warnings.`;
  const user = JSON.stringify({
    fileName: input.fileName,
    description: input.description,
    businessCategory: input.businessCategory,
    hasImage: Boolean(input.imageDataUrl),
  });

  if (process.env.PICKAPP_AI_ROUTE === "n8n" || env.n8nBaseUrl) {
    try {
      const result = await callN8nWebhook("/webhook/ai-product-creator", {
        imageDataUrl: input.imageDataUrl,
        fileName: input.fileName,
        description: input.description,
        businessCategory: input.businessCategory,
      });
      const parsed = productDraftSchema.parse(result?.draft ?? result);
      return { ...parsed, provider: "n8n" };
    } catch (error) {
      if (!env.llmApiKey) throw error;
    }
  }

  if (env.llmApiKey) {
    const { text, model } = await callOpenAiCompatible({
      system,
      user,
      imageDataUrl: input.imageDataUrl,
      model: env.llmModel,
    });
    const parsed = productDraftSchema.parse(cleanJson(text));
    return { ...parsed, provider: "llm", model };
  }

  const baseName = input.fileName?.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Producto";
  return {
    name: baseName.slice(0, 80),
    description:
      input.description?.trim() ||
      `Ficha generada en modo demo para ${baseName}. Revisa y edita la información antes de publicar.`,
    category: input.businessCategory?.trim() || "Sin categoría",
    tags: ["demo", "pendiente de revisión"],
    visible_features: ["Imagen proporcionada por la emprendedora"],
    promotional_text: "Producto listo para revisar, editar y publicar en PICKAPP.",
    suggested_price: null,
    confidence: "low",
    warnings: ["Modo demo: conecta PICKAPP_LLM_API_KEY o n8n para generar una ficha con IA real."],
    provider: "demo-fallback",
  };
}

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function demoAssistantReply(catalog: AssistantCatalogItem[], message: string): AssistantReply {
  const normalized = normalize(message);
  const matches = catalog
    .map((product) => {
      const haystack = normalize([product.name, product.description, product.category, ...product.tags].join(" "));
      let score = 0;
      for (const token of normalized.split(/\W+/).filter((part) => part.length > 3)) {
        if (haystack.includes(token)) score += 1;
      }
      if (normalize(product.name).split(/\W+/).some((part) => part.length > 3 && normalized.includes(part))) score += 3;
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = matches[0]?.product;
  const quantityMatch = message.match(/(\d+)\s*(unidad|unidades|pcs|piezas)?/i);
  const wantsOrder = /(quiero|comprar|pedido|pide|llevar|agregar|añadir|reservar)/i.test(message);

  if (!top) {
    return {
      reply:
        "Puedo ayudarte con productos, precios y disponibilidad usando el catálogo real de la tienda. Escribe el nombre del producto o una palabra clave, por ejemplo: «¿tienen el vestido midi?».",
      intent: { type: "none", product_id: null, quantity: null, confidence: 0.4 },
      referenced_product_ids: [],
      provider: "demo-fallback",
    };
  }

  const available = top.available_quantity;
  const variants = top.variants.length
    ? ` Variantes registradas: ${top.variants.map((variant) => variant.name).join(", ")}.`
    : "";
  let reply = `${top.name} cuesta ${top.price.toFixed(2)} ${top.currency}. Disponibilidad actual: ${available} unidad(es).${variants}`;
  if (available <= 0) reply += " Ahora mismo no hay stock disponible; puedo ayudarte a buscar alternativas.";
  let intent: AssistantReply["intent"] = { type: "product_question", product_id: top.id, quantity: null, confidence: 0.75 };
  if (wantsOrder && available > 0) {
    const quantity = quantityMatch ? Math.max(1, Number(quantityMatch[1])) : 1;
    reply += ` Si quieres, puedo dejar preparada una intención de pedido por ${quantity} unidad(es); la compra se confirma solo después de validar stock y crear el pedido.`;
    intent = { type: "order_intent", product_id: top.id, quantity, confidence: 0.85 };
  }
  return {
    reply,
    intent,
    referenced_product_ids: [top.id, ...matches.slice(1, 4).map((item) => item.product.id)],
    provider: "demo-fallback",
  };
}

export async function generateAssistantReply(input: {
  business: BusinessDTO;
  catalog: AssistantCatalogItem[];
  history: Array<{ role: "customer" | "assistant"; content: string }>;
  message: string;
  customerName?: string;
}): Promise<AssistantReply> {
  if (env.llmApiKey) {
    const system = `Eres el asistente comercial de PICKAPP para el negocio "${input.business.name}".
Responde solo con JSON: {"reply": string, "intent": {"type": "none|product_question|order_intent|handoff", "product_id": string|null, "quantity": number|null, "confidence": number}, "referenced_product_ids": string[]}.
Reglas: nunca inventes stock, precios, pagos ni pedidos confirmados. Usa solo el catálogo JSON entregado. Si falta información, pide aclaración. Si el cliente quiere comprar, devuelve intent.order_intent con product_id y quantity; no confirmes la compra.`;
    const user = JSON.stringify({
      business: { name: input.business.name, category: input.business.category },
      catalog: input.catalog.slice(0, 80),
      history: input.history.slice(-10),
      customerName: input.customerName,
      message: input.message,
    });
    try {
      const { text, model } = await callOpenAiCompatible({ system, user, model: env.llmModel });
      const parsed = assistantReplySchema.parse(cleanJson(text));
      return { ...parsed, provider: "llm", model };
    } catch {
      // Fall back to deterministic catalog matching so the MVP remains usable.
    }
  }
  return demoAssistantReply(input.catalog, input.message);
}
