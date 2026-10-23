import { describe, expect, it } from "vitest";
import { searchUniverse } from "@/lib/mcp/universeSearch";

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
});
