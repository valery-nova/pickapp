import "server-only";

import { JsonRpcProvider, Wallet } from "ethers";
import { env } from "@/lib/env";
import { orderReceiptHash } from "@/lib/avalanche-fuji";
import type { OrderDTO } from "@/lib/data/contracts";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const WORKFLOW = "avalanche-fuji";
const EVENT = "order.receipt.anchored";

export interface FujiAnchorStatus {
  status: "prepared" | "anchored" | "pending" | "error";
  anchored: boolean;
  tx_hash?: string | null;
  explorer_url?: string | null;
  block_number?: number | null;
  error?: string;
}

function isConfigured() {
  return env.dataMode === "supabase" && Boolean(env.avalancheFujiPrivateKey);
}

async function findAnchor(order: OrderDTO, receiptHash: string) {
  const supabase = getSupabaseServerClient();
  const result = await supabase
    .from("automation_logs")
    .select("payload")
    .eq("business_id", order.business_id)
    .eq("workflow", WORKFLOW)
    .eq("event", EVENT)
    .limit(200);
  if (result.error) throw new Error(result.error.message);
  const rows = (result.data ?? []) as Array<{ payload: Record<string, unknown> | null }>;
  return rows
    .map((row) => row.payload)
    .filter((payload): payload is Record<string, unknown> => Boolean(payload))
    .find((payload) => payload.order_id === order.id && payload.receipt_hash === receiptHash);
}

async function recordAnchor(order: OrderDTO, payload: Record<string, unknown>) {
  const supabase = getSupabaseServerClient();
  const result = await supabase.from("automation_logs").insert({
    business_id: order.business_id,
    workflow: WORKFLOW,
    event: EVENT,
    status: "success",
    payload,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function getOrderReceiptAnchor(order: OrderDTO): Promise<FujiAnchorStatus> {
  if (!isConfigured()) return { status: "prepared", anchored: false };

  const receiptHash = orderReceiptHash(order);
  try {
    const existing = await findAnchor(order, receiptHash);
    if (existing && existing.tx_hash) {
      const txHash = String(existing.tx_hash);
      return {
        status: "anchored",
        anchored: true,
        tx_hash: txHash,
        explorer_url: existing.explorer_url ? String(existing.explorer_url) : `${env.avalancheFujiExplorerUrl}${txHash}`,
        block_number: typeof existing.block_number === "number" ? existing.block_number : null,
      };
    }

    const provider = new JsonRpcProvider(env.avalancheFujiRpcUrl, env.avalancheFujiChainId);
    const wallet = new Wallet(env.avalancheFujiPrivateKey as string, provider);
    const to = env.avalancheFujiAnchorAddress ?? wallet.address;
    const tx = await wallet.sendTransaction({
      to,
      value: 0,
      data: `0x${receiptHash}`,
      gasLimit: 100_000,
    });
    const receipt = await tx.wait();
    const explorerUrl = `${env.avalancheFujiExplorerUrl}${tx.hash}`;
    const payload = {
      order_id: order.id,
      receipt_hash: receiptHash,
      tx_hash: tx.hash,
      block_number: receipt?.blockNumber ?? null,
      chain_id: env.avalancheFujiChainId,
      explorer_url: explorerUrl,
      anchored_at: new Date().toISOString(),
    };
    await recordAnchor(order, payload);
    return {
      status: "anchored",
      anchored: true,
      tx_hash: tx.hash,
      explorer_url: explorerUrl,
      block_number: receipt?.blockNumber ?? null,
    };
  } catch (error) {
    return {
      status: "error",
      anchored: false,
      error: error instanceof Error ? error.message : "AVALANCHE_FUJI_ANCHOR_FAILED",
    };
  }
}
