# 0001 - Record architecture decisions

Status: Accepted

## Context

This is a weekend hackathon repo, but the small number of decisions that are genuinely hard to reverse mid-build (data-fetching architecture, AI provider choice, map/draw library) benefit from a one-time written record — both so the reasoning isn't lost if the team splits up work, and so a decision isn't silently re-litigated under time pressure.

## Decision

Use lightweight Architecture Decision Records in `docs/adr/`, one file per significant decision, following the process in `docs/adr/README.md`. Reserve these for decisions that would be costly to unwind — not routine implementation choices, which stay as normal code/PR history.

## Alternatives considered

- No formal record, rely on PR descriptions and commit messages — rejected because PR history doesn't surface a decision's _alternatives considered_ or _why_, which is what matters most for a fast-moving weekend project with limited time to redo work.
- A single running `DECISIONS.md` log — rejected in favor of one-file-per-decision so each can be superseded independently without editing a shared file.

## Consequences

Adds a small amount of overhead (one file) per significant decision. In exchange, `docs/knowledge-base/` (dataset/framework research) and `docs/adr/` (decisions made from that research) stay cleanly separated: knowledge base is what we learned, ADRs are what we decided to do about it.
