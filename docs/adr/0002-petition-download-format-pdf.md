# 0002 - Petition download format is PDF

Status: Accepted

## Context

`docs/prd.md` §5 (Core user flow, step 6) originally specified that the drafted petition is downloaded as text/markdown: "the draft renders in an editable text area. User can revise freely, then copy or download it as text/markdown." Since then the team has decided the download should be a PDF instead. The petition is meant to be handed to a DOT reviewer or attached to a community board application — a plain text/markdown file reads as a draft artifact, not a document someone would print or forward as-is, whereas a PDF matches how the output is actually meant to be used downstream. No download feature has been built yet (no API routes, no PDF library in `package.json`), so this is a forward decision for implementation, not a rework of shipped code.

## Decision

The petition download format is **PDF**, not text/markdown. This supersedes the text/markdown export decision in `docs/prd.md` §5 step 6 (PRD updated alongside this ADR to match). The specific generation approach (browser print-to-PDF, a client-side library, a server-rendered route, etc.) is intentionally left open — that's an implementation choice for whoever builds the download feature, not part of this decision.

## Alternatives considered

- Keep text/markdown, as originally specified in the PRD — rejected: it's a weaker deliverable for a document meant to be printed, emailed, or attached to a formal application.
- Offer both text/markdown and PDF — rejected for scope: this is a weekend hackathon build: one well-supported export format beats two half-supported ones, and the PRD's human-in-the-loop "review before export" story doesn't require multiple formats.

## Consequences

Implementation will need to add a PDF-generation dependency, since none exists in `package.json` today (no `jsPDF`, `@react-pdf/renderer`, `pdf-lib`, or `puppeteer`). The specific approach is deferred to whoever implements the download feature (browser print-to-PDF needs no new dependency and fits the Vercel Functions/serverless constraints most easily; a library adds more layout control at the cost of bundle size or server rendering time). `docs/prd.md` §5 step 6 is updated to say "PDF" so the PRD and this ADR stay consistent.
