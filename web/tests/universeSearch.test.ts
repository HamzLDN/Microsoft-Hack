import { describe, expect, it } from "vitest";
import { confidentMatch, searchUniverse } from "@/lib/mcp/universeSearch";

const SAMPLE = [
  { ticker: "TIP", name: "iShares TIPS Bond" },
  { ticker: "BND", name: "Vanguard Total Bond Market" },
  { ticker: "MSFT", name: "Microsoft" },
];

describe("searchUniverse", () => {
  it("matches messy iShares TIPS query", () => {
    const hits = searchUniverse("Whats the current stock pricue for i shares tips bont", SAMPLE);
    expect(hits[0]?.entry.ticker).toBe("TIP");
  });

  it("treats a full fund name as one match and a single word bond as none", () => {
    expect(confidentMatch("iShares TIPS Bond", SAMPLE)).toEqual({ kind: "one", entry: SAMPLE[0] });
    expect(confidentMatch("bond", SAMPLE).kind).toBe("none");
    expect(confidentMatch("hello", SAMPLE).kind).toBe("none");
  });
});
