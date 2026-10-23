export type { AnalystOutput, Candidate, Evidence, Portfolio, Rule, ScoreBreakdown } from "@shared/contract";
import type { Rule } from "@shared/contract";

export type AgentName = "bull" | "bear" | "judge";
export type AppRule = Rule & { learnedFrom?: number };

export type FormInput = {
  age: number;
  retireAge: number;
  horizon: number;
  purpose: string;
  risk: number; // 1 to 10
  maxHolding: number | "AI";
  favour: string[];
  exclude: string[];
  freeText: string;
  /** Dollars being invested. Holdings and loss figures are scaled to this. */
  savings: number;
};

export const DEFAULT_FORM: FormInput = {
  age: 58, retireAge: 67, horizon: 9, purpose: "Income later", risk: 5, maxHolding: "AI",
  favour: ["Healthcare", "Dividend payers"], exclude: [], freeText: "", savings: 100_000,
};

/** Saved preferences from before this field existed still mean $100,000. */
export function savingsOf(f: { savings?: number } | null | undefined): number {
  const n = Number(f?.savings);
  return Number.isFinite(n) && n >= 100 ? Math.round(n) : 100_000;
}

export const DEMO_TEXT =
  "I need this money to last. I can't stomach losing more than about 15% in a bad year. No gambling or tobacco. I like companies that pay dividends, and I'm interested in healthcare.";

export const THEMES = ["Technology", "AI and software", "Healthcare", "Biotech", "Financials", "Consumer staples", "Consumer discretionary",
  "Industrials", "Energy", "Clean energy", "Utilities", "Real estate", "Materials", "Communication", "Dividend payers"];

export const EXCLUDE_GROUPS: Record<string, string[]> = {
  Ethical: ["Tobacco", "Alcohol", "Gambling", "Adult", "Weapons"],
  Environmental: ["Fossil fuels", "Coal", "Mining"],
  "Financial risk": ["Unprofitable", "Penny stocks", "High debt"],
  Geography: ["China listed", "Emerging markets"],
  "Investment type": ["Leveraged ETFs", "Crypto exposed"],
};
