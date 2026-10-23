import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The writing rule: no dashes as punctuation anywhere in what users read.
const files = ["components", "lib", "app"].flatMap((d) => walk(path.join(__dirname, "..", d)));
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [path.join(dir, e.name)] : []));
}

describe("copy", () => {
  it("has no en or em dashes in any user facing source", () => {
    const offenders = files.filter((f) => /[\u2013\u2014]/.test(fs.readFileSync(f, "utf8").replace(/\\u201[34]/g, "")));
    expect(offenders).toEqual([]);
  });
});
