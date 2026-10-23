import type { Rule } from "../../shared/contract";

export type { Candidate, Portfolio } from "../../shared/contract";

export type AppRule = Rule & { learnedFrom?: number };

export type FormInput = {
  age: number;
  retireAge: number;
  horizon: number;
  purpose: string;
  risk: number;
  maxHolding: number | "AI";
  favour: string[];
  exclude: string[];
  freeText: string;
};

export const DEFAULT_FORM: FormInput = {
  age: 58,
  retireAge: 67,
  horizon: 9,
  purpose: "Income later",
  risk: 5,
  maxHolding: "AI",
  favour: ["Healthcare", "Dividend payers"],
  exclude: [],
  freeText: "",
};

export const DEMO_TEXT =
  "I need this money to last. I can't stomach losing more than about 15% in a bad year. No gambling or tobacco. I like companies that pay dividends, and I'm interested in healthcare.";

export const THEMES = [
  "Technology",
  "AI and software",
  "Healthcare",
  "Biotech",
  "Financials",
  "Consumer staples",
  "Consumer discretionary",
  "Industrials",
  "Energy",
  "Clean energy",
  "Utilities",
  "Real estate",
  "Materials",
  "Communication",
  "Dividend payers",
];

export const EXCLUDE_GROUPS: Record<string, string[]> = {
  Ethical: ["Tobacco", "Alcohol", "Gambling", "Adult", "Weapons"],
  Environmental: ["Fossil fuels", "Coal", "Mining"],
  "Financial risk": ["Unprofitable", "Penny stocks", "High debt"],
  Geography: ["China listed", "Emerging markets"],
  "Investment type": ["Leveraged ETFs", "Crypto exposed"],
};

export type User = { id: string; email: string };
