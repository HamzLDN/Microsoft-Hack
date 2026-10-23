import { describe, expect, it } from "vitest";
import { lookup, lookupFollowUp } from "@/lib/ai/glossary";

describe("glossary lookup", () => {
  it("explains volatility even when it is misspelled", () => {
    expect(lookup("What is volitilty")).toMatch(/price usually swings/);
    expect(lookup("what is volatility")).toMatch(/price usually swings/);
  });

  it("uses the previous question when the user says just explain", () => {
    const earlier = ["iShares TIPS Bond", "What is volitilty", "I can explain terms. Try volatility or TIP."];
    expect(lookupFollowUp("Just explain", earlier)).toMatch(/price usually swings/);
    expect(lookupFollowUp("Just explain")).toBeUndefined();
  });
});
