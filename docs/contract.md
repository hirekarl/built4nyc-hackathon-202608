---
type: contract
status: canonical
source: frozen from the implemented Phase 1 TypeScript contract and UI, 2026-08-15
---

# Intersection safety-report contract

This document is the canonical frontend/backend contract for EZStreet. The machine-checked source is `src/types/report.ts`; the backend must return the exact shapes and literals documented here.

## Endpoint and authority

- Endpoint: `POST /api/reports/intersection`.
- Schema version: the request, success response, and error response use the literal `"1"`.
- The 50-meter circle is server-authoritative; the server rejects every other radius and does not trust the browser's geometry.
- The period from `2025-01-01` inclusive to `2026-01-01` exclusive is server-authoritative.
- A coordinate names `longitude` and `latitude` explicitly; GeoJSON uses longitude/latitude order while the request object keeps named fields so order cannot be inferred incorrectly.
- Every request field is untrusted input and is revalidated against official eligible NYC Street Centerline data before report generation.
- The request cannot contain raw query text. In particular, the browser cannot supply SoQL, alternate dates, alternate radii, or replacement official names.
- Intersection candidates group centerline endpoints on the exact `longitude|latitude|level` key with no snapping tolerance, name them from `stname_label` falling back to `full_street_name`, and require at least two distinct eligible street names; multi-roadbed nodes such as Grand Central stay separate candidates and remain a documented limitation rather than one named intersection.

## Request body

Every request field is required and non-null.

| Field path | Type or literal | Required | Nullable | Meaning |
| --- | --- | --- | --- | --- |
| `schemaVersion` | `"1"` | Yes | No | Contract version. |
| `selection.kind` | `"intersection"` | Yes | No | Only official intersection selection is supported. |
| `selection.displayName` | `string` | Yes | No | Client's locked official display name; revalidated by the server. |
| `selection.coordinate.latitude` | `number` | Yes | No | WGS84 latitude in the valid range. |
| `selection.coordinate.longitude` | `number` | Yes | No | WGS84 longitude in the valid range. |
| `selection.streetNames[]` | `string[]` item | Yes | No | Official street names attached to the selected candidate; revalidated by the server. |
| `selection.physicalIds[]` | `string[]` item | Yes | No | Official contributing centerline physical IDs; revalidated by the server. |
| `boundary.kind` | `"circle"` | Yes | No | Analysis-boundary geometry kind. |
| `boundary.radiusMeters` | `50` | Yes | No | Fixed server-authoritative radius in meters. |
| `period.startInclusive` | `"2025-01-01"` | Yes | No | Inclusive calendar-year start. |
| `period.endExclusive` | `"2026-01-01"` | Yes | No | Exclusive calendar-year end. |

The server resolves the submitted selection to an eligible official intersection. A submitted name, coordinate, street-name array, or physical-ID array never overrides the normalized official record.

## HTTP 200 success body

Every success field is required. Only fields explicitly marked nullable can contain `null`.

| Field path | Type or literal | Required | Nullable | Meaning |
| --- | --- | --- | --- | --- |
| `schemaVersion` | `"1"` | Yes | No | Contract version. |
| `reportId` | `string` | Yes | No | Server-created report identifier. |
| `generatedAt` | `string` | Yes | No | ISO 8601 generation timestamp. |
| `status` | `"complete" \| "partial"` | Yes | No | Completeness of the deterministic report. |
| `summary` | `string` | Yes | No | Deterministic neutral summary of the report result. |
| `selection.kind` | `"intersection"` | Yes | No | Normalized official selection kind. |
| `selection.displayName` | `string` | Yes | No | Normalized official intersection display name. |
| `selection.coordinate.latitude` | `number` | Yes | No | Normalized WGS84 latitude. |
| `selection.coordinate.longitude` | `number` | Yes | No | Normalized WGS84 longitude. |
| `selection.streetNames[]` | `string[]` item | Yes | No | Normalized official street name. |
| `selection.physicalIds[]` | `string[]` item | Yes | No | Normalized official centerline physical ID. |
| `boundary.kind` | `"circle"` | Yes | No | Normalized boundary kind. |
| `boundary.radiusMeters` | `50` | Yes | No | Server-enforced radius in meters. |
| `period.startInclusive` | `"2025-01-01"` | Yes | No | Server-enforced inclusive period start. |
| `period.endExclusive` | `"2026-01-01"` | Yes | No | Server-enforced exclusive period end. |
| `metrics.crashes` | `number \| null` | Yes | Yes | Matching crash count. |
| `metrics.peopleInjured` | `number \| null` | Yes | Yes | Total people injured. |
| `metrics.peopleKilled` | `number \| null` | Yes | Yes | Total people killed. |
| `metrics.pedestriansInjured` | `number \| null` | Yes | Yes | Pedestrians injured. |
| `metrics.pedestriansKilled` | `number \| null` | Yes | Yes | Pedestrians killed. |
| `metrics.cyclistsInjured` | `number \| null` | Yes | Yes | Cyclists injured. |
| `metrics.cyclistsKilled` | `number \| null` | Yes | Yes | Cyclists killed. |
| `metrics.motoristsInjured` | `number \| null` | Yes | Yes | Motorists injured. |
| `metrics.motoristsKilled` | `number \| null` | Yes | Yes | Motorists killed. |
| `metrics.contributingFactors` | `Array<{ factor: string; count: number }> \| null` | Yes | Yes | Ranked documented named factors, excluding the separate Unspecified count. |
| `metrics.contributingFactors[].factor` | `string` | Yes when the array has items | No | Documented factor label. |
| `metrics.contributingFactors[].count` | `number` | Yes when the array has items | No | Deterministic occurrence count for that factor. |
| `metrics.unspecifiedFactors` | `number \| null` | Yes | Yes | Count of the documented `Unspecified` factor. |
| `priorityZone.status` | `"matched" \| "not_matched" \| "unavailable"` | Yes | No | Boundary overlap result; no zone name exists in the source schema. |
| `limitations[]` | `string[]` item | Yes | No | Stable disclosure of unavailable or limited data. The array can be empty. |
| `notes[]` | `string[]` item | Yes | No | Stable data-quality note. The array can be empty. |
| `sources[]` | `ReportSource[]` item | Yes | No | Provenance for each required source. |
| `sources[].name` | `string` | Yes | No | Official dataset name. |
| `sources[].datasetId` | `"inkn-q76z" \| "h9gi-nx95" \| "qzji-nvbd"` | Yes | No | Real NYC Open Data dataset ID. |
| `sources[].url` | `string` | Yes | No | Official dataset portal URL. |
| `sources[].role` | `"selection_geometry" \| "collision_metrics" \| "priority_context"` | Yes | No | Dataset's deterministic role in the report. |
| `sources[].retrievalStatus` | `"available" \| "unavailable"` | Yes | No | Whether the required source result was available. |
| `sources[].retrievedAt` | `string \| null` | Yes | Yes | ISO 8601 retrieval time, or `null` when unavailable. |
| `sources[].queryDescription` | `string` | Yes | No | Stable description of the documented access pattern. |

### Completeness and missing-data semantics

- `complete` means every required metric was computed and the Priority Zone check completed; `partial` means a truthful report object exists but at least one required fact or source is unavailable.
- A `null` metric means unavailable; it is not zero and the UI renders it as `Unavailable`.
- A `0` metric is a successful zero result from a valid query, not missing data.
- An empty `[]` is a successful contributing factors result with no reported factors.
- A successful zero result is neutral and is not evidence that an intersection is safe.
- A degraded collision source produces HTTP 200 with `partial` status and affected collision metrics set to `null`.
- A degraded Priority Zone source produces HTTP 200 with `partial` status and `priorityZone.status` set to `unavailable`.
- A malformed required numeric field produces a `partial` report with the affected metric set to `null`; it is never coerced to zero.
- When multiple required sources are unavailable, return HTTP 200 `partial` if a truthful report object can still be assembled and disclose every limitation.
- Return HTTP 503 only when no trustworthy report object can be assembled.

The report always includes provenance for `inkn-q76z` as `selection_geometry`, `h9gi-nx95` as `collision_metrics`, and `qzji-nvbd` as `priority_context`, each with `available` or `unavailable` retrieval status.

## Error body

The response body is the exact `IntersectionReportErrorResponse` union. Every field is required and non-null.

| Field path | Type or literal | Required | Nullable | Meaning |
| --- | --- | --- | --- | --- |
| `schemaVersion` | `"1"` | Yes | No | Contract version. |
| `error.code` | Validation code or `"source_failure"` | Yes | No | Stable machine-readable error discriminator. |
| `error.message` | `string` | Yes | No | User-safe explanation. |
| `error.retryable` | `false` for validation or `true` for source failure | Yes | No | Whether retrying the same valid selection can succeed. |

HTTP status is not duplicated in the body; the transport status and `error.code` provide separate transport and application semantics.

`error.message` is user-safe and must not include raw SoQL, an upstream response, credentials, or a stack trace.

| Error code | HTTP | `retryable` | Panel state | Meaning |
| --- | --: | --- | --- | --- |
| `invalid_request` | 400 | `false` | `validation-error` | Body is absent, malformed, or does not match the required object shape. |
| `invalid_coordinate` | 400 | `false` | `validation-error` | Coordinate is non-finite, out of global range, or outside a generous New York City bounding box (latitude 40.4 to 41.0, longitude -74.3 to -73.65). The city box also catches a longitude/latitude pair supplied in the wrong order. |
| `unsupported_radius` | 400 | `false` | `validation-error` | Boundary is not the fixed 50-meter circle. |
| `unsupported_period` | 400 | `false` | `validation-error` | Period is not calendar year 2025 with the locked inclusive/exclusive dates. |
| `unsupported_selection_kind` | 400 | `false` | `validation-error` | Selection kind is not `intersection`. |
| `raw_query_not_allowed` | 400 | `false` | `validation-error` | Request attempts to provide query language or another server-owned query input. |
| `intersection_not_found` | 400 | `false` | `validation-error` | Submitted selection cannot be resolved to an eligible official intersection. |
| `source_failure` | 503 | `true` | `source-failure` | No trustworthy report object can be assembled from required sources. |

The validation error branch always has `retryable: false`; the `source_failure` branch always has `retryable: true`.

## Panel-state mapping

| Transport or body result | Panel state |
| --- | --- |
| HTTP 400 validation error | `validation-error` |
| HTTP 503 `source_failure` | `source-failure` |
| HTTP 200 with `status: complete` and nonzero or unavailable crash count | `complete` |
| HTTP 200 with `status: partial` and nonzero or unavailable crash count | `partial` |
| HTTP 200 with `metrics.crashes: 0` | `zero-match`; the report retains its `complete` or `partial` completeness label and limitations |

The page's `initial`, `ready`, and `loading` states are local interaction states and are not response-body variants.

## PRD §9 field diff

The original PRD section 9 described intent without exact paths. This frozen contract makes the following field-by-field decisions explicit:

| PRD §9 concept | Frozen field decision |
| --- | --- |
| Schema version | `schemaVersion` is required and fixed to `"1"` on request, success, and error bodies. |
| Locked intersection | `selection.kind`, `selection.displayName`, `selection.coordinate.latitude`, `selection.coordinate.longitude`, `selection.streetNames[]`, and `selection.physicalIds[]` are required and revalidated. |
| Circle boundary | `boundary.kind` is `circle`; `boundary.radiusMeters` is the literal `50`. |
| Calendar year | `period.startInclusive` and `period.endExclusive` use the fixed 2025 literals. |
| Report metadata | `reportId`, `generatedAt`, `status`, and the implemented deterministic `summary` are required. |
| Normalized echo | `selection`, `boundary`, and `period` use the same required nested paths in the success body. |
| Nullable deterministic metrics | Every additive metric path is required with `number \| null`; contributing factors are an array or `null`, and `Unspecified` has its own nullable count. |
| Priority Zone status | The nested field is `priorityZone.status` with `matched`, `not_matched`, or `unavailable`. |
| Quality disclosures | `notes[]` and `limitations[]` are required arrays. |
| Source provenance | `sources[]` requires name, dataset ID, official URL, role, retrieval status, nullable retrieval time, and query description with the exact paths above. |
| Errors | The implemented discriminated union adds `error.code`, a user-safe `error.message`, and literal `error.retryable`; HTTP status remains transport-only. |

No request or success field is optional. The TypeScript definitions supersede any earlier candidate wording in PRD §9.

## Live-route conformance verification (Phase 3 Step 3.2)

Both PRD §12 acceptance fixtures were driven through the real `POST /api/reports/intersection` route against live NYC Open Data on 2026-08-15. **No shape drift exists**: every field path, enum value, and nullability in the live 200 body matches this document and `src/types/report.ts` exactly. Neither side required a fix.

**Every deterministic metric is identical between the Phase 1 mock and the live route**, for both fixtures — the diff-of-zero check this step exists to prove:

| Fixture | Crashes | Injured | Killed | Pedestrians | Cyclists | Motorists |
| --- | --: | --: | --: | --- | --- | --- |
| W 40 ST at 5 AVE | 6 | 7 | 1 | 4 inj / 1 killed | 1 inj / 0 killed | 2 inj / 0 killed |
| E 42 ST at PARK AVE | 9 | 4 | 0 | 2 inj / 0 killed | 2 inj / 0 killed | 0 inj / 0 killed |

Fixture 2 also emits its documented labeling gap: `3 of 9 crash records are missing on_street_name.`

### Expected mock-versus-live differences

The mock fixtures in `src/lib/mocks/report.mock.ts` differ from the live response in the fields below. **These are the server correctly re-deriving the official record, not drift to reconcile** — the request table above already states that a submitted name, coordinate, street-name array, or physical-ID array never overrides the normalized official record. A test asserting a mock value in any of these fields is asserting a mock artifact, not a contract rule.

| Field | Mock | Live | Why |
| --- | --- | --- | --- |
| Fixture 1 `selection.displayName` | `W 40 ST at 5 AVE` | `E 40 ST at 5 AVE at W 40 ST` | 5 AVE splits E/W 40 ST; all three segments share the node, and the grouping rule names every eligible street at that exact coordinate. |
| Fixture 1 `selection.physicalIds` | `["183093"]` | `["23415","1940","183093","1941"]` | Every contributing centerline segment at the node is returned, not just the one the client happened to submit. |
| Fixture 2 `selection.displayName` | `E 42 ST at PARK AVE` | `PARK AVE at E 42 ST` | Street order follows the server's normalization, not the client's submitted order. |
| Fixture 2 `selection.physicalIds` | `["73419","148625"]` | `["148625","73419","73416"]` | Same re-derivation as fixture 1. |
| Fixture 2 `priorityZone.status` / `status` | `unavailable` / `partial` | `matched` / `complete` | The mock deliberately encodes a degraded-source case so the panel's `partial` state stays testable. Live, that intersection genuinely overlaps a Priority Zone and all three sources resolve. |

Because the UI renders `report.selection.displayName` from the response, the locked name shown in the report can legitimately differ from the label hovered on the map. That is the official record asserting itself over client-submitted text, which is the ADR-0003 security boundary working as designed.

Note that fixture 2 carries a non-empty `limitations[]` while still reporting `status: complete`. Completeness describes source availability, not data quality: a disclosed labeling gap in otherwise-retrieved data is a limitation, not a degraded source.

## Deterministic and AI boundary

All factual metrics, completeness status, Priority Zone status, limitations, and source provenance are deterministic. AI never computes, changes, hides, or authorizes report facts. This contract defines no AI request or response fields.
