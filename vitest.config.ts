import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    exclude: ["**/node_modules/**", "e2e/**"],
    coverage: {
      provider: "v8",
      // `lcov` is what the Codecov upload step in CI ingests; `json-summary`
      // writes coverage/coverage-summary.json for anything that needs the
      // numbers programmatically. `text` and `html` stay for local use.
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**"],
      exclude: ["src/types/report.ts", "**/*.d.ts", "**/*.test.{ts,tsx}"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
