import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Keys live in the repo root .env (shared with the data service). Load them without overriding real env vars.
try {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(path.join(here, "..", ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
    serverComponentsExternalPackages: ["@modelcontextprotocol/sdk", "zod"],
  },
  webpack(config) {
    // shared/contract.ts lives outside web/, so point its imports (zod) at web/node_modules
    config.resolve.modules = [path.join(here, "node_modules"), ...(config.resolve.modules || ["node_modules"])];
    return config;
  },
};
export default nextConfig;
