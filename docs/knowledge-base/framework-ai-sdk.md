---
type: framework
status: optional — product boundary accepted, provider access unverified
source: repository stack guidance and accepted product decision, 2026-08-15
---

# Vercel AI SDK for an optional report explanation

The deterministic safety report is complete and useful without a model. If the team adds generative AI, use one user-triggered action labeled `Explain this report`.

## Input boundary

Pass only the normalized structured report object. Do not pass raw SoQL, API credentials, arbitrary map text, or untrusted instructions as model control text.

The input may include:

- selection, boundary, and period;
- computed metrics;
- Priority Zone status;
- completeness status;
- limitations; and
- source names and dataset IDs.

## Output boundary

The explanation may summarize the strongest findings and important limitations in plain language. It must not:

- calculate, rank, or alter report facts;
- introduce values absent from the report;
- claim causation;
- declare a location safe or unsafe;
- hide or soften `Partial`; or
- produce a petition or government recommendation in the MVP.

Render the result under an `AI explanation` heading, visually separate from `NYC Open Data facts`. If generation fails, preserve the report and show the explanation as unavailable.

## Implementation decisions still open

- Select one model provider; do not build a multi-provider abstraction.
- Confirm the environment-variable name and ignored local storage.
- Run one minimal model-access request before feature work.
- Choose single-shot or streaming generation based on the remaining time.
- Define a small output limit and basic request throttling for demo cost control.

Use the current `vercel:ai-sdk` guidance when implementation begins.

Used by: [PRD §10](../prd.md#10-optional-ai-explanation) and [ADR 0005](../adr/0005-deterministic-report-and-bounded-ai.md).
