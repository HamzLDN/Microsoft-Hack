import { describe, expect, it } from "vitest";
import { applyMemory, cleanLlmRules, formRules, jaccard, keywordRules, mergeRules } from "@/lib/ai/parser";
import { DEFAULT_FORM, DEMO_TEXT } from "@/lib/types";

describe("preference parser", () => {
  it("turns the demo sentence into the expected rules", () => {
    const rules = keywordRules(DEMO_TEXT);
    const loss = rules.find((r) => r.field === "max_bad_year_loss")!;
    expect(loss.value).toBe(15000);
    expect(loss.kind).toBe("hard");
    const tags = rules.filter((r) => r.field === "exclude_tag").flatMap((r) => r.value as string[]);
    expect(tags).toEqual(expect.arrayContaining(["Gambling", "Tobacco"]));
    expect(rules.find((r) => r.field === "min_dividend_yield")!.kind).toBe("soft");
    expect(rules.find((r) => r.field === "favour_sector")!.value).toContain("Healthcare");
  });
  it("every text rule quotes words that really appear", () => {
    for (const r of keywordRules(DEMO_TEXT)) expect(DEMO_TEXT).toContain(r.quote!);
  });
  it("form maps directly: exclusions are hard, favourites soft", () => {
    const rules = formRules({ ...DEFAULT_FORM, exclude: ["Weapons"], favour: ["Healthcare"] });
    expect(rules.find((r) => r.field === "exclude_tag")!.kind).toBe("hard");
    expect(rules.find((r) => r.field === "favour_sector")!.kind).toBe("soft");
  });
  it("drops LLM rules whose quote is not in the text, and unknown tags", () => {
    const out = cleanLlmRules({ rules: [
      { field: "exclude_tag", value: ["Tobacco"], quote: "No gambling or tobacco.", kind: "hard" },
      { field: "exclude_tag", value: ["Tobacco"], quote: "words never written", kind: "hard" },
      { field: "exclude_tag", value: ["Unicorns"], quote: "No gambling or tobacco.", kind: "hard" },
    ] }, DEMO_TEXT);
    expect(out).toHaveLength(1);
  });
  it("merges without duplicates and numbers rules C1..Cn", () => {
    const merged = mergeRules(formRules({ ...DEFAULT_FORM, exclude: ["Tobacco"] }), keywordRules(DEMO_TEXT));
    expect(merged.map((r) => r.id)).toEqual(merged.map((_, i) => `C${i + 1}`));
    const tobacco = merged.filter((r) => r.field === "exclude_tag" && (r.value as string[]).includes("Tobacco"));
    expect(tobacco).toHaveLength(1);
  });
  it("applies a correction confirmed twice, and labels it as learned", () => {
    const text = "I'd like some tech exposure.";
    const parsed = keywordRules(text);
    expect(parsed[0].kind).toBe("soft");
    const corrections = [{ phrase: text, rule: { field: "favour_sector", kind: "hard" as const, value: ["Technology"], text: "Must include technology", op: "in" }, timesConfirmed: 2, updatedAt: "" }];
    const out = applyMemory(parsed, text, corrections);
    expect(out[0].kind).toBe("hard");
    expect(out[0].learnedFrom).toBe(2);
  });
  it("jaccard similarity", () => {
    expect(jaccard("I like tech", "I like tech")).toBe(1);
    expect(jaccard("I like tech", "no oil")).toBe(0);
  });
});
