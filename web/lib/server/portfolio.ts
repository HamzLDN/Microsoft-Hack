import { personalWeights } from "../learning";
import type { Portfolio } from "../types";
import { db } from "./db";
import { flask } from "./flask";

export type PortfolioRequest = { rules: unknown[]; horizon?: number; risk?: number; maxHolding?: unknown; overrides?: Record<string, string>; weights?: Record<string, number>; adjustments?: Record<string, number> };

export async function buildPortfolio(body: PortfolioRequest, userId?: string): Promise<Portfolio & { weights: Record<string, number> }> {
  const defaults = await flask<Record<string, number>>(`/weights?horizon=${body.horizon ?? 9}&risk=${body.risk ?? 5}`);
  const weights = body.weights ?? personalWeights(defaults, userId ? db().learned[userId] : undefined);
  return flask("/portfolio", { body: { ...body, weights }, timeoutMs: 90000 });
}
