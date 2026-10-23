import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
      "@": path.resolve(__dirname, "."),
      zod: path.resolve(__dirname, "node_modules/zod"),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
