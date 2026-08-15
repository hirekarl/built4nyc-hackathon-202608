# Architecture Decision Records

Short records of significant, hard-to-reverse technical decisions for this project — what was decided, why, and what alternatives were considered. Not for every choice: use an ADR when a decision would be genuinely costly to unwind (a data store, a core library, an API contract), not for routine implementation details.

## Index

- [0001 - Record architecture decisions](./0001-record-architecture-decisions.md)
- [0002 - Petition download format is PDF](./0002-petition-download-format-pdf.md)

## Process

1. Copy `template.md` to `NNNN-short-title.md`, using the next sequential number, zero-padded to 4 digits.
2. Fill in Context, Decision, Consequences. Keep it short — a few paragraphs, not a design doc.
3. Status starts as `Proposed`; update to `Accepted` once settled, or `Superseded by 000X` if a later ADR replaces it. Don't edit or delete old ADRs to reflect new decisions — write a new one that supersedes it, so the history stays intact.
4. Add the new file to the Index above.
