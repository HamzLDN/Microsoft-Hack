// Shared data contract. Mirrored in shared/contract.py. Change both together.
import { z } from "zod";

export const Evidence = z.object({
  id: z.string(),
  ticker: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.enum(["%", "$", "x", "count", "years"]),
  source: z.enum(["Finnhub", "yfinance", "SEC EDGAR", "FRED", "Engine"]),
  asOf: z.string(),
  url: z.string().optional(),
});
export type Evidence = z.infer<typeof Evidence>;

export const Rule = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(["hard", "soft"]),
  field: z.enum([
    "horizon_years", "max_bad_year_loss", "exclude_tag", "favour_sector", "min_dividend_yield",
    "profitable", "max_holding_pct", "max_volatility", "note",
  ]),
  op: z.enum(["<=", ">=", "==", "in", "not_in"]),
  value: z.unknown(),
  source: z.enum(["form", "text"]),
  quote: z.string().optional(),   // exact words the rule came from
  kindReason: z.string(),         // why hard or soft, shown to the user
  confidence: z.number().min(0).max(1),
});
export type Rule = z.infer<typeof Rule>;

export const ScoreBreakdown = z.object({
  total: z.number(),
  parts: z.array(z.object({
    name: z.enum(["Growth", "Profitability", "Stability", "Income", "Valuation", "News"]),
    weight: z.number(),
    value: z.number(),
    evidenceIds: z.array(z.string()),
  })),
  ruleAdjustments: z.array(z.object({ ruleId: z.string(), points: z.number() })),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdown>;

const Point = z.object({ text: z.string(), evidenceIds: z.array(z.string()), ruleId: z.string().optional() });

export const Candidate = z.object({
  ticker: z.string(),
  name: z.string(),
  sector: z.string(),
  type: z.enum(["stock", "etf"]),
  status: z.enum(["included", "excluded"]),
  amount: z.number(),
  score: ScoreBreakdown,
  pros: z.array(Point),
  cons: z.array(Point),
  checks: z.array(z.object({ ruleId: z.string(), pass: z.boolean(), detail: z.string() })),
  mainReason: z.string(),
  whatWouldGetItIn: z.string().optional(),
});
export type Candidate = z.infer<typeof Candidate>;

export const Portfolio = z.object({
  split: z.object({ stocks: z.number(), bonds: z.number(), cash: z.number() }),
  holdings: z.array(Candidate),
  considered: z.array(Candidate),
  badYearLoss: z.number(),
  typicalRange: z.tuple([z.number(), z.number()]),
  ruleSummary: z.array(z.object({ ruleId: z.string(), status: z.string() })),
});
export type Portfolio = z.infer<typeof Portfolio>;

export const AnalystOutput = z.object({
  agent: z.enum(["fundamentals", "markets", "fit"]),
  stance: z.enum(["include", "exclude", "neutral"]),
  confidence: z.number().min(0).max(1),
  points: z.array(z.object({
    text: z.string(),               // uses **bold** for key figures
    polarity: z.enum(["pro", "con"]),
    evidenceIds: z.array(z.string()).min(1),
  })).min(2),
  summary: z.string(),
  fallback: z.boolean(),
});
export type AnalystOutput = z.infer<typeof AnalystOutput>;
