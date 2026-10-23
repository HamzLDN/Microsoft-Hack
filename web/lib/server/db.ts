// Small JSON file store. Enough for a hackathon demo, no native modules, survives restarts.
import fs from "node:fs";
import path from "node:path";

export type Correction = { phrase: string; rule: { field: string; kind: "hard" | "soft"; value: unknown; text: string; op: string }; timesConfirmed: number; updatedAt: string };
export type Learned = { weightAdjust: Record<string, number>; notes: string[] };
export type Stats = { analystRuns: number; firstTryPass: number; retried: number; fallbacks: number; numbersChecked: number; unsupportedBlocked: number };

type Shape = {
  users: { id: string; email: string; salt: string; hash: string; createdAt: string }[];
  prefs: Record<string, { savedAt: string; data: unknown }[]>;
  learned: Record<string, Learned>;
  feedback: { userId: string; kind: string; before: unknown; after: unknown; context: unknown; createdAt: string }[];
  corrections: Correction[];
  parses: { userId: string; parsed: number; corrected: number; at: string }[];
  stats: Stats;
};

const FILE = process.env.MANDATE_DB_FILE || path.join(process.cwd(), "data", "db.json");
const EMPTY: Shape = { users: [], prefs: {}, learned: {}, feedback: [], corrections: [], parses: [],
  stats: { analystRuns: 0, firstTryPass: 0, retried: 0, fallbacks: 0, numbersChecked: 0, unsupportedBlocked: 0 } };

let mem: Shape | null = null;

export function db(): Shape {
  if (mem) return mem;
  try {
    mem = { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    mem = structuredClone(EMPTY);
  }
  return mem!;
}

export function save() {
  if (!mem) return;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(mem));
  fs.renameSync(tmp, FILE);
}

export function resetForTests() {
  mem = structuredClone(EMPTY);
}
