import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/__tests__/**/*.test.ts", "app/**/__tests__/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["lib/scoring/**", "lib/import/**"],
      thresholds: { lines: 90 },
    },
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
