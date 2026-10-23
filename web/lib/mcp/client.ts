/**
 * Server-side MCP client for the Mandate chat API.
 * Spawns the mandate-data MCP server (stdio) and reuses one connection per Node process.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";

let clientPromise: Promise<import("@modelcontextprotocol/sdk/client/index.js").Client> | null = null;

function mcpServerEntry(): string {
  const fromEnv = process.env.MANDATE_MCP_ENTRY;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const candidates = [
    path.join(process.cwd(), "..", "mcp-server", "dist", "index.js"),
    path.join(process.cwd(), "mcp-server", "dist", "index.js"),
  ];
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) {
    throw new Error(
      "Mandate MCP server not built. Run: cd mcp-server && npm install && npm run build",
    );
  }
  return hit;
}

function textFromResult(result: { content?: { type: string; text?: string }[]; isError?: boolean }): string {
  const part = result.content?.find((c) => c.type === "text");
  return part?.text ?? "";
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
      const entry = mcpServerEntry();
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [entry],
        env: {
          ...process.env,
          DATA_SERVICE_URL: process.env.DATA_SERVICE_URL || "http://localhost:5001",
        },
      });
      const client = new Client({ name: "mandate-web", version: "0.1.0" });
      await client.connect(transport);
      return client;
    })();
  }
  return clientPromise;
}

/** Invoke a tool on the server-side mandate-data MCP server. */
export async function callMcpTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = await getClient();
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    throw new Error(textFromResult(result) || `MCP tool ${name} failed`);
  }
  const raw = textFromResult(result);
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}
