# 0005 - Make the safety report deterministic and bound AI to explanation

Status: Accepted

Supersedes: [ADR 0002](./0002-petition-download-format-pdf.md) for the current product direction.

## Context

The original product centered an AI-drafted petition and an editable PDF. The accepted direction now centers a general street-safety report. Crash totals and Priority Zone results must be reproducible from documented NYC Open Data fields, and missing data must not become invented values. The hackathon prompt still benefits from a visible generative-AI role, but AI must not weaken the report's factual integrity.

## Decision

The safety report is the authoritative product output. Deterministic server-side code owns:

- selection and boundary validation;
- collision queries and all numeric aggregation;
- contributing-factor ranking;
- Priority Zone overlap;
- complete/partial status;
- limitations and source provenance; and
- the report object used by both the UI and download.

When required data is unavailable, affected values are `null`, the report is `Partial`, the missing source is named, valid facts remain visible, and the user can retry. A successful zero-row query produces zero values with neutral wording and never proves that a location is safe.

The initial export is a generic print-friendly version of the same report object. A finalized petition, permit, government-report format, editable PDF, and user observations are optional later features.

An optional user-triggered action may generate an `AI explanation`. The model receives only the structured report and may explain its strongest findings, period, boundary, and limitations. It cannot calculate or alter facts, claim causation, declare a place safe or unsafe, or hide a partial status. Model failure does not affect the factual report.

## Alternatives considered

- **AI-generated petition as the main output:** deferred because the core user need is first to gather credible, sourced information and because petition format can be decided later.
- **AI-generated safety scoring:** rejected because it would make the result less reproducible and could encourage unsupported safety claims.
- **No visible AI feature:** retained as a product-safe fallback, but the bounded explanation remains an optional way to demonstrate the hackathon's generative-AI theme.
- **Editable PDF as a required export:** deferred because a generic print/download report is sufficient for the MVP and avoids format-specific implementation risk.

## Consequences

The report contract and deterministic tests must land before AI work. The UI must visually separate `NYC Open Data facts` from `AI explanation`. The model/provider remains an implementation decision and must pass a minimal access check before the optional feature begins. Petition and permit content cannot silently return to the core flow without a new product decision.
