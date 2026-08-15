---
type: framework
status: candidate
source: repo CLAUDE.md stack guidance
---

# Vercel AI SDK for petition generation

Repo convention (per `CLAUDE.md`) is to use this project's `vercel:*` skills for anything Vercel/Next.js-specific rather than re-deriving guidance — for the petition-drafting LLM call, that means `vercel:ai-sdk` at implementation time.

Decisions still open, to make at scaffold/implementation time (see `vercel:ai-sdk` skill for current API):

- Which model provider to use for generation — pick one, don't build multi-provider abstraction (per [PRD §7](../prd.md#7-ai-usage) non-goals).
- Structured input: pass the server-computed crash summary (counts, top contributing factors, Priority Zone match) as the prompt input, not raw user text — reduces prompt-injection surface, keeps the draft grounded in real numbers.
- Streaming vs. single-shot generation for the draft — streaming likely reads better in the demo (visible progress) but adds UI complexity; decide based on time budget.

Used by: [PRD §7](../prd.md#7-ai-usage).
