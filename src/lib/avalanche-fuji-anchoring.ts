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

const anchorPromises = new Map<string, Promise<FujiAnchorStatus>>();
const sentAnchors = new Map<string, { tx_hash: string; explorer_url: string; block_number: number | null }>();

function isConfigured() {
  return env.dataMode === "supabase" && Boolean(env.avalancheFujiPrivateKey);
}

function anchorKey(order: OrderDTO, receiptHash: string) {
  return `${order.id}:${receiptHash}`;
}

function statusFromPayload(payload: Record<string, unknown>): FujiAnchorStatus {
  const txHash = String(payload.tx_hash);
  const explorerUrl = payload.explorer_url ? String(payload.explorer_url) : `${env.avalancheFujiExplorerUrl}${txHash}`;
  const blockNumber = typeof payload.block_number === "number" ? payload.block_number : null;
  const confirmed = payload.confirmed === true || blockNumber !== null;
  return {
    status: confirmed ? "anchored" : "pending",
    anchored: true,
    tx_hash: txHash,
    explorer_url: explorerUrl,
    block_number: blockNumber,
  };
}

async function findAnchor(order: OrderDTO, receiptHash: string) {
  const supabase = getSupabaseServerClient();
  const result = await supabase
    .from("automation_logs")
    .select("payload")
    .eq("business_id", order.business_id)
    .eq("workflow", WORKFLOW)
    .eq("event", EVENT)
    .contains("payload", { order_id: order.id, receipt_hash: receiptHash })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return (result.data?.payload as Record<string, unknown> | null) ?? null;
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

async function confirmExistingAnchor(order: OrderDTO, receiptHash: string, payload: Record<string, unknown>): Promise<FujiAnchorStatus> {
  const current = statusFromPayload(payload);
  if (current.status === "anchored") return current;
  const txHash = String(payload.tx_hash);
  try {
    const provider = new JsonRpcProvider(env.avalancheFujiRpcUrl, env.avalancheFujiChainId);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return current;
    if (receipt.status === 0) {
      return { status: "error", anchored: false, tx_hash: txHash, explorer_url: current.explorer_url, error: "AVALANCHE_FUJI_TX_REVERTED" };
    }
    const blockNumber = receipt.blockNumber ?? null;
    const explorerUrl = current.explorer_url ?? `${env.avalancheFujiExplorerUrl}${txHash}`;
    await recordAnchor(order, {
      order_id: order.id,
      receipt_hash: receiptHash,
      tx_hash: txHash,
      explorer_url: explorerUrl,
      block_number: blockNumber,
      confirmed: true,
      chain_id: env.avalancheFujiChainId,
      anchored_at: typeof payload.anchored_at === "string" ? payload.anchored_at : new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    }).catch(() => undefined);
    return { status: "anchored", anchored: true, tx_hash: txHash, explorer_url: explorerUrl, block_number: blockNumber };
  } catch {
    return current;
  }
}

async function anchorOrderReceipt(order: OrderDTO, receiptHash: string): Promise<FujiAnchorStatus> {
  const key = anchorKey(order, receiptHash);
  const cached = sentAnchors.get(key);
  if (cached) {
    return confirmExistingAnchor(order, receiptHash, {
      tx_hash: cached.tx_hash,
      explorer_url: cached.explorer_url,
      block_number: cached.block_number,
      confirmed: cached.block_number !== null,
    });
  }

  try {
    const existing = await findAnchor(order, receiptHash);
    if (existing?.tx_hash) return confirmExistingAnchor(order, receiptHash, existing);

    const provider = new JsonRpcProvider(env.avalancheFujiRpcUrl, env.avalancheFujiChainId);
    const wallet = new Wallet(env.avalancheFujiPrivateKey as string, provider);
    const to = env.avalancheFujiAnchorAddress ?? wallet.address;
    const tx = await wallet.sendTransaction({
      to,
      value: 0,
      data: `0x${receiptHash}`,
      gasLimit: 100_000,
    });
    const explorerUrl = `${env.avalancheFujiExplorerUrl}${tx.hash}`;
    const sent = { tx_hash: tx.hash, explorer_url: explorerUrl, block_number: null as number | null };
    sentAnchors.set(key, sent);

    await recordAnchor(order, {
      order_id: order.id,
      receipt_hash: receiptHash,
      tx_hash: tx.hash,
      explorer_url: explorerUrl,
      block_number: null,
      confirmed: false,
      chain_id: env.avalancheFujiChainId,
      anchored_at: new Date().toISOString(),
    }).catch(() => undefined);

    let blockNumber: number | null = null;
    try {
      const receipt = await tx.wait();
      blockNumber = receipt?.blockNumber ?? null;
    } catch {
      blockNumber = null;
    }
    sent.block_number = blockNumber;

    await recordAnchor(order, {
      order_id: order.id,
      receipt_hash: receiptHash,
      tx_hash: tx.hash,
      explorer_url: explorerUrl,
      block_number: blockNumber,
      confirmed: blockNumber !== null,
      chain_id: env.avalancheFujiChainId,
      anchored_at: new Date().toISOString(),
      confirmed_at: blockNumber !== null ? new Date().toISOString() : null,
    }).catch(() => undefined);

    return {
      status: blockNumber === null ? "pending" : "anchored",
      anchored: true,
      tx_hash: tx.hash,
      explorer_url: explorerUrl,
      block_number: blockNumber,
    };
  } catch (error) {
    const sent = sentAnchors.get(key);
    if (sent) {
      return {
        status: sent.block_number === null ? "pending" : "anchored",
        anchored: true,
        tx_hash: sent.tx_hash,
        explorer_url: sent.explorer_url,
        block_number: sent.block_number,
      };
    }
    return {
      status: "error",
      anchored: false,
      error: error instanceof Error ? error.message : "AVALANCHE_FUJI_ANCHOR_FAILED",
    };
  }
}

export async function getOrderReceiptAnchor(order: OrderDTO): Promise<FujiAnchorStatus> {
  if (!isConfigured()) return { status: "prepared", anchored: false };
  const receiptHash = orderReceiptHash(order);
  const key = anchorKey(order, receiptHash);
  const existing = anchorPromises.get(key);
  if (existing) return existing;
  const promise = anchorOrderReceipt(order, receiptHash);
  anchorPromises.set(key, promise);
  try {
    return await promise;
  } finally {
    anchorPromises.delete(key);
  }
}
