import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise re-injects a generated block into AGENTS.md on every
  // start. AGENTS.md is hand-maintained here as the Codex mirror of CLAUDE.md,
  // and src/types/report.contract.test.ts asserts the generated block is absent.
  agentRules: false,
};

export default nextConfig;
