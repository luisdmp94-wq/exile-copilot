import path from "path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(CONFIG_DIR, "./src"),
      "@shared": path.resolve(CONFIG_DIR, "./shared"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "server/**/*.test.ts"],
    testTimeout: 30000,
  },
});
