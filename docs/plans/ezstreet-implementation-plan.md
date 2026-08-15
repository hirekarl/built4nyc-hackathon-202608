# EZStreet end-to-end implementation plan

## Context

This repo's product direction, architecture, and datasets are already locked in (`docs/prd.md`, `docs/adr/0003-0005`, `docs/knowledge-base/`), and the app is scaffolded (Next.js 16 App Router, TDD/coverage gate, Husky, CI) but only has a placeholder homepage — no map, API route, report UI, or adapters exist yet. GitHub issue #21 sets the team's build order and ownership: **antunishdPursuit** builds the frontend first and, in doing so, determines the real API contract (which may supersede the PRD §9 placeholder); **1abbasia** builds the backend off that finalized contract; **rhaeyyan** integrates the two tracks; **hirekarl** (repo admin) owns infra, code review, and deployment throughout. Issue #20 (optional AI explanation) was closed not-planned — the team deferred it, so no AI work appears anywhere in this plan; the deterministic report is complete and demoable without it (ADR-0005).

This plan turns that ownership sequence into an executable build: a small Phase 0 to fix stale placeholder content before anyone builds on it, then Phase 1 (Frontend) → Phase 2 (Backend) → Phase 3 (Integration), each broken into TDD-ready `[SPEC]`/`[SPIKE]` + `[FORCES]` blocks per `CLAUDE.md`'s `tech-lead → sdet → builder` handoff schema, with hirekarl's infra/deploy checkpoints threaded in at the points where they actually gate the next step (e.g. the Socrata app token must exist before Phase 2's collision queries go live). Every `[SPEC]` below is ready to relay directly to `sdet`/`builder` — the goal is that any teammate can pick up a step and start immediately without re-deriving scope.

**Non-negotiables carried into every step** (see `CLAUDE.md`, `docs/adr/0005-deterministic-report-and-bounded-ai.md`): every crash count, injury/fatality tally, contributing-factor rollup, Priority Zone overlap, and completeness status is computed deterministically server-side — no AI anywhere in this plan. A missing value is `null`, never `0`. The server owns the 50m radius and the 2025 period; the browser never supplies trusted geometry or dates. One shared report object renders on screen and in print/download — never recomputed independently. ≥90% coverage, TDD (red before green), Conventional Commits, no AI `Co-Authored-By` trailer, feature branch + PR + rebase merge.

**File layout used throughout** (new — nothing beyond the placeholder exists yet):

```text
src/types/report.ts                        shared report/contract types
src/lib/mocks/report.mock.ts                Phase 1 mock report fixtures (PRD §9/§12 shaped)
src/lib/centerline-client.ts                client-side viewport fetch of eligible centerlines (map display)
src/lib/geometry.ts                         circle math, coordinate-order helpers, polygon-intersection op
src/lib/validation.ts                       request validation (radius/period/selection-kind/coords/no-raw-SoQL)
src/lib/adapters/centerline.ts              server-side centerline fetch + eligibility filter + node grouping
src/lib/adapters/collisions.ts              server-side collision query + fetch
src/lib/adapters/priority-zones.ts          server-side Priority Zone fetch/cache + intersection join
src/lib/report.ts                           deterministic aggregation + report object assembly
src/app/api/reports/intersection/route.ts   POST handler
src/components/Map.tsx                      MapLibre + OpenFreeMap Bright, layers, hover/select, circle
src/components/ReportPanel.tsx              side panel state machine + report hierarchy rendering
src/components/PrintReport.tsx              print/download rendering of the shared report object
src/app/page.tsx                            composition root
src/app/layout.tsx                          metadata
e2e/report-panel-a11y.spec.ts               Phase 1 accessibility e2e
e2e/report-flow.spec.ts                     Phase 3 end-to-end flow
docs/contract.md                            Phase 1's finalized-contract deliverable (consumed by Phase 2)
docs/infra.md                               Phase 0's env var / Vercel doc
```

---

## Phase 0 — Fix stale placeholder + infra readiness (owner: hirekarl)

Small pre-work so nothing downstream builds on the old petition-era pitch or hits an undocumented env var gap.

- [ ] **0.1 — Replace stale petition-pitch copy with the safety-report pitch**

  ```text
  [SPEC]
  - Objective: Replace src/app/page.tsx's stale petition-first copy ("Draw a street segment... draft a petition...") with copy matching the accepted safety-report pitch (ADR-0005: deterministic crash-data report for a selected intersection, no petition, no AI), and update src/app/page.test.tsx to assert the new copy instead of the stale text.
  - Inputs/Outputs: Input: current src/app/page.tsx, src/app/page.test.tsx. Output: "EZStreet" H1 retained, new description text describing intersection-selection + deterministic crash-data report flow; test asserts new text; no route/behavior change.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: `npm test -- src/app/page.test.tsx` passes; existing e2e/home.spec.ts H1 assertion + axe scan still pass unmodified.
  - Constraints: Do not change the "EZStreet" H1 text (e2e/home.spec.ts depends on it). Copy only — no map/report functionality here. Don't reference the deferred AI explanation feature.
  - Edge Cases: N/A — static copy change.
  - Files: src/app/page.tsx, src/app/page.test.tsx

  [FORCES]
  1. Accuracy of product description > minimizing diff size.
  ```

- [ ] **0.2 — Fix stale layout metadata**

  ```text
  [SPEC]
  - Objective: Update src/app/layout.tsx's metadata description to match the safety-report pitch, consistent with Step 0.1.
  - Inputs/Outputs: Input: current layout.tsx metadata object. Output: metadata.description updated; title unchanged unless it also references petitions.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Existing suite stays green; add a minimal assertion (extend page.test.tsx or a layout smoke test) that metadata.description does not contain "petition".
  - Constraints: Scope to metadata fields only.
  - Edge Cases: None significant.
  - Files: src/app/layout.tsx, src/app/page.test.tsx

  [FORCES]
  1. Consistency with Step 0.1 copy > independent wording.
  ```

- [ ] **0.3 — Document Vercel project link + Socrata app-token env var strategy**

  ```text
  [SPEC]
  - Objective: Write docs/infra.md documenting: (a) the Vercel project is already linked (.vercel/project.json: projectId prj_WwONv6YDzuwPcVH6wbpcoToigEK8, org team_cDQvQDbC6zAtDDaayeZIeywF, "ezstreet", Next.js, Node 24.x) — no relinking needed; (b) the Socrata app-token env var strategy per PRD §8: name it SOCRATA_APP_TOKEN, server-only (no NEXT_PUBLIC_ prefix, never sent to the client bundle), must be added via `vercel env` for dev+preview+prod before Phase 2 Step 2.4's collision queries are deployed; (c) .env.local and .vercel/.env.development.local already exist locally and are gitignored; (d) flag CLAUDE.md's "not yet linked to Vercel" line as stale — non-blocking follow-up, not fixed in this step.
  - Inputs/Outputs: Input: .vercel/project.json, PRD §8. Output: docs/infra.md.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Manual review — doc states the token var name, server-only scope, and "add before Phase 2" requirement. Docs-only step, no automated test.
  - Constraints: Never commit an actual token value. Don't touch .env.local contents. Don't edit CLAUDE.md here (flag only).
  - Edge Cases: N/A.
  - Files: docs/infra.md

  [FORCES]
  1. Unblocking Phase 2's env dependency early > deferring infra docs until the route is built.
  ```

---

## Phase 1 — Frontend (owner: antunishdPursuit)

Gated on Phase 0. Builds against a mocked report response matching PRD §9's candidate contract so frontend work isn't blocked on the backend. **The last step in this phase is the deliverable Phase 2 is gated on.**

- [ ] **1.1 — Shared contract types + mock report fixture**

  ```text
  [SPEC]
  - Objective: Define shared TypeScript contract types (request/response shape, selection, boundary, period, metrics, Priority Zone status, limitations, sources) in src/types/report.ts per PRD §9, and a mock report fixture module (src/lib/mocks/report.mock.ts) using PRD §12's two acceptance fixtures as literal values (W 40 ST at 5 AVE: 6 crashes/7 injured/1 killed/4 ped injured/1 ped killed/1 cyclist injured/0 killed/2 motorist injured/0 killed; E 42 ST at PARK AVE: 9 crashes/4 injured/0 killed/2 ped injured/2 cyclist injured, 3/9 rows missing on_street_name) so downstream UI steps render real, contract-shaped data.
  - Inputs/Outputs: Input: PRD §9, PRD §12, docs/knowledge-base/dataset-crashes.md fixtures. Output: src/types/report.ts, src/lib/mocks/report.mock.ts, a unit test confirming the mocks type-check and match the documented numbers exactly.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Vitest unit test asserting mock report objects satisfy the type shape and equal the exact PRD §12 fixture numbers.
  - Constraints: Types are provisional until Step 1.9 finalizes them. Any missing/not-yet-computed metric field must type as `number | null`, never bare `number`.
  - Edge Cases: Include a partial-status mock (missing source) and a zero-match mock (valid zero totals, neutral copy — never "safe") to exercise later panel states.
  - Files: src/types/report.ts, src/lib/mocks/report.mock.ts, src/types/report.test.ts

  [FORCES]
  1. Contract fidelity to PRD §9/§12 fixture numbers > convenience/shorthand types.
  ```

- [ ] **1.2 — Map viewport load of eligible centerlines**

  ```text
  [SPEC]
  - Objective: Render a MapLibre GL JS map (OpenFreeMap Bright basemap, ADR-0004) opening on the Bryant Park/Grand Central Manhattan view, with a viewport-scoped client fetch of eligible centerlines (rw_type='1' AND blank nonped, per docs/knowledge-base/dataset-nyc-street-centerline.md) rendered as an app-owned line layer above the basemap, refetching on viewport change.
  - Inputs/Outputs: Input: https://data.cityofnewyork.us/resource/inkn-q76z.json, MapLibre viewport bounds. Output: src/components/Map.tsx (basemap + centerline layer), src/lib/centerline-client.ts exposing fetchEligibleCenterlines(bbox) applying the eligibility filter in the SoQL `$where` clause (never fetch-all-then-filter).
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Component test mocking fetch, asserting the built SoQL query contains `rw_type='1'` and a blank-nonped condition, and that Map.tsx calls it on mount and on `moveend`; axe-core scan on the page (per e2e/home.spec.ts's pattern) shows no new violations.
  - Constraints: Authorizes new dependency `maplibre-gl` (tech-lead-approved via this SPEC). Preserve OpenFreeMap attribution. This client fetch is display-only — separate from and not a substitute for Phase 2's server-side validation adapter.
  - Edge Cases: Empty-viewport response renders no line layer, no error. Basemap failure degrades to the documented screenshot/recording fallback (ADR-0004 — OpenFreeMap has no SLA) rather than a blank crash.
  - Files: src/components/Map.tsx, src/lib/centerline-client.ts, src/components/Map.test.tsx, package.json

  [FORCES]
  1. Server/client separation (display fetch vs. server-validated selection, ADR-0003) > code reuse between client and future server adapter.
  ```

- [ ] **1.3 — SPIKE: Grand Central multi-roadbed node naming fallback**

  ```text
  [SPIKE]
  - Objective: Decide a naming-fallback rule for intersection candidate nodes where shared-coordinate grouping is ambiguous (Grand Central's multi-roadbed/viaduct geometry, per docs/knowledge-base/dataset-nyc-street-centerline.md), for use in Step 1.4. The verified control fixture (physical ID 183093 → "W 40 ST between 5 AVE and AVE OF THE AMERICAS") must keep working under the chosen rule.
  - Inputs/Outputs: Input: live centerline data around Grand Central, ADR-0003's node-grouping rule. Output: a short written decision (in-code comment in centerline-client.ts + one line in docs/contract.md, added in Step 1.9) — Grand Central may remain a documented limitation, not a solved case.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: A written decision note stating the fallback rule and explicitly accepting Grand Central as a documented limitation for the ordinary-intersection demo; no new runtime behavior required here (implemented in Step 1.4).
  - Constraints: Time-boxed — do not attempt to fully solve multi-roadbed topology.
  - Edge Cases: Confirm the rule doesn't break the W 40 ST/5 AVE control fixture.
  - Files: src/lib/centerline-client.ts (comment only), docs/contract.md (decision note)

  [FORCES]
  1. Shipping the ordinary-intersection demo fixture reliably > generalizing to every topology edge case.
  ```

- [ ] **1.4 — Hoverable/selectable intersections with 34px hit target and 50m circle**

  ```text
  [SPEC]
  - Objective: Group eligible centerline endpoints (from 1.2) by exact shared coordinate into intersection candidates (≥2 eligible named streets, Step 1.3's naming fallback applied), render a separate 34px hit-target layer above a smaller visible marker layer (ADR-0004), show official street names on hover, and on click lock the selection and render the fixed 50m circle boundary.
  - Inputs/Outputs: Input: eligible centerlines, ADR-0003 (fixed 50m radius, mirrored client-side as a display-only constant), ADR-0004 (hit-target/visible layer separation). Output: hover tooltip with street names; click sets selectedIntersection state + draws a 50m circle via src/lib/geometry.ts.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Component test confirming the hit-target layer's radius is 34px and distinct from the visible layer; hover-simulation test asserts tooltip text equals the grouped street names; click-simulation test asserts selection state updates and a 50m-radius circle geometry is added.
  - Constraints: The client-side 50m constant is display-only and non-authoritative — Phase 2's server re-validates it (ADR-0003); never let the client send this radius as a trusted value.
  - Edge Cases: A node with only 1 eligible street at the shared coordinate is not exposed as a candidate (ADR-0003's ≥2 rule). Grand Central applies Step 1.3's decision.
  - Files: src/components/Map.tsx, src/lib/geometry.ts, src/lib/centerline-client.ts, src/components/Map.test.tsx

  [FORCES]
  1. ADR-0004's verified 34px hit target and hit/visible layer separation > a simpler single-layer implementation.
  ```

- [ ] **1.5 — Side panel state machine**

  ```text
  [SPEC]
  - Objective: Build src/components/ReportPanel.tsx implementing all 8 PRD §6.4 states — initial, ready, loading, complete, partial, zero-match, validation-error, source-failure — each with its own copy/visual treatment, driven by props (no internal fetch yet — consumes Step 1.1's mock fixtures).
  - Inputs/Outputs: Input: selection state (1.4), a report-or-error value (mocked). Output: panel renders exactly the right one of the 8 states; zero-match uses neutral language for valid zero totals, never "safe".
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: One component test per state asserting state-specific text/role renders; a test asserting zero-match copy never contains "safe".
  - Constraints: Renders off Step 1.1's typed mocks only — live fetch wiring is Step 3.1. Missing metric fields render as an explicit "not available" treatment, never "0".
  - Edge Cases: Reselecting mid-loading must reset to ready/loading, not show stale complete data — cover with a test.
  - Files: src/components/ReportPanel.tsx, src/components/ReportPanel.test.tsx, src/lib/mocks/report.mock.ts

  [FORCES]
  1. Exact PRD §6.4 state coverage > a simplified 3-state (loading/success/error) shortcut.
  ```

- [ ] **1.6 — Report hierarchy rendering (mocked)**

  ```text
  [SPEC]
  - Objective: In ReportPanel's complete/partial states, render the full PRD §6.6 hierarchy — status banner, headline facts, road-user breakdown, contributing-factor rollup (with "Unspecified" as its own category), Priority Zone status (matched/not_matched/unavailable, never a zone name per docs/knowledge-base/dataset-priority-zones.md), limitations, and sources (dataset name/ID/role/retrieval time/status) — using Step 1.1's mocks as the exact rendered numbers.
  - Inputs/Outputs: Input: both mock fixtures from 1.1. Output: rendered DOM matching PRD §12's exact numbers per fixture.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Component tests asserting rendered text contains the exact fixture numbers for both fixtures (including the missing-on_street_name note for fixture 2), and that Priority Zone renders exactly one of matched/not_matched/unavailable with no zone-name text.
  - Constraints: Render the one shared report object as-is — never recompute or reshape values inside the component.
  - Edge Cases: Fixture 2's data-quality note must render as a visible limitation while counts remain shown (disclose, don't suppress).
  - Files: src/components/ReportPanel.tsx, src/components/ReportPanel.test.tsx

  [FORCES]
  1. Single shared report object rendered as-is > per-component reformatting/recomputation.
  ```

- [ ] **1.7 — Accessibility pass**

  ```text
  [SPEC]
  - Objective: Add keyboard activation for intersection selection (Tab to focus, Enter/Space to select — equivalent to pointer click), visible focus styles, an aria-live region announcing panel state transitions, and an @axe-core/playwright scan of the composed page (map + panel), following e2e/home.spec.ts's existing pattern.
  - Inputs/Outputs: Input: Step 1.4's map interactions, Step 1.5's panel states. Output: keyboard-operable selection flow; `aria-live="polite"` region; new e2e spec.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: New e2e/report-panel-a11y.spec.ts: (1) keyboard-only flow reaches ready state, (2) axe scan on the composed page returns zero violations, (3) the aria-live region's text changes on a simulated panel-state transition.
  - Constraints: Reuse the existing @axe-core/playwright pattern, not a new scanning approach. Canvas-rendered map layers aren't natively focusable — likely needs an accessible overlay list or keyboard-selectable proxy element for candidate intersections.
  - Edge Cases: Verify the keyboard-only path reaches the same "ready to confirm" state as the pointer path.
  - Files: src/components/Map.tsx, src/components/ReportPanel.tsx, e2e/report-panel-a11y.spec.ts

  [FORCES]
  1. Keyboard/screen-reader parity with the pointer flow > pointer-only interaction shortcuts.
  ```

- [ ] **1.8 — Print/download of the shared report object**

  ```text
  [SPEC]
  - Objective: Build src/components/PrintReport.tsx rendering the same shared report object (mock now, live in Phase 3) for print (`@media print` styles) and a download trigger (e.g. `window.print()`), invoked from ReportPanel's complete/partial states, per PRD §11 — must render identical values to the on-screen panel, never an independently computed second view.
  - Inputs/Outputs: Input: the report object type from src/types/report.ts. Output: print-optimized render + download trigger.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Component test rendering PrintReport with a mock fixture and asserting its DOM values match ReportPanel's rendered values for the same fixture — a divergence-proof comparison test.
  - Constraints: No separate fetch or recomputation path for print — consumes the exact same object reference/shape rendered on screen.
  - Edge Cases: Printing a partial-status report must retain visible limitations/source-failure notes, not drop them.
  - Files: src/components/PrintReport.tsx, src/components/PrintReport.test.tsx, src/components/ReportPanel.tsx

  [FORCES]
  1. Identical shared-object rendering across screen and print > a leaner print-specific summary view.
  ```

- [ ] **1.9 — Finalize and document the frontend's actual contract (Phase 1 deliverable — gates Phase 2)**

  ```text
  [SPEC]
  - Objective: Lock the real request/response contract Steps 1.1-1.8 actually landed on (may supersede PRD §9 per issue #21) by finalizing src/types/report.ts as canonical and writing docs/contract.md: the request shape frontend sends (selection, boundary, period), the response shape it expects (status, metrics with null-vs-zero semantics, Priority Zone enum, limitations, sources), plus an explicit diff section against PRD §9. This is what Phase 2 implements against.
  - Inputs/Outputs: Input: final state of report.ts/report.mock.ts as actually consumed by ReportPanel/PrintReport. Output: docs/contract.md, frozen src/types/report.ts.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: A check (lint/grep-based or a documented manual-review checklist item enforced by sdet's audit) confirming every field ReportPanel.tsx/PrintReport.tsx read is present in docs/contract.md; existing suite stays green.
  - Constraints: Documentation + type-freeze only — no new UI behavior. Must explicitly call out any deviation from PRD §9 (field naming, enum values, nullability) so Phase 2 doesn't build against the stale placeholder.
  - Edge Cases: If frontend needed a field PRD §9 didn't anticipate, document it explicitly rather than diverging silently.
  - Files: docs/contract.md, src/types/report.ts

  [FORCES]
  1. Frontend-as-source-of-truth per issue #21 > strict adherence to PRD §9's placeholder contract.
  ```

**Infra checkpoint (hirekarl):** open a draft PR at Phase 1 branch creation for visibility; verify the Vercel preview builds after Steps 1.2/1.4 (map renders) and again after Step 1.9 (contract finalized) before Phase 2 starts.

---

## Phase 2 — Backend (owner: 1abbasia)

Gated on Phase 1 Step 1.9's `docs/contract.md` — not on the PRD §9 placeholder. Hold off on route implementation until that artifact exists.

- [ ] **2.1 — Server-side centerline adapter + eligibility filter + intersection-candidate grouping**

  ```text
  [SPEC]
  - Objective: Build src/lib/adapters/centerline.ts: fetch eligible centerlines server-side (rw_type='1' AND blank nonped, excluding rw_type 2/3/4/6/9/10/12 per docs/knowledge-base/dataset-nyc-street-centerline.md), group eligible endpoints by exact shared coordinate into candidates (≥2 eligible named streets), apply Step 1.3's naming fallback, and expose a function resolving a client-submitted selection (coordinate + physical IDs) against real server data — never trusting client-submitted geometry/names directly.
  - Inputs/Outputs: Input: physicalid/rw_type/nonped/full_street_name/street_name/stname_label/b5sc/bphys_id/globalid/the_geom from https://data.cityofnewyork.us/resource/inkn-q76z.json, docs/contract.md's selection shape. Output: a function resolving a submitted selection to a validated server-side intersection record, or null.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Unit test against the verified fixture (physical ID 183093 → "W 40 ST between 5 AVE and AVE OF THE AMERICAS"); a negative test excluding a non-eligible rw_type (e.g. Highway=2); a negative test rejecting a coordinate with only 1 eligible street.
  - Constraints: Eligibility filter must be expressed in the SoQL `$where` clause — never fetch-all-then-filter. This adapter is the security boundary (ADR-0003) — client selection data is untrusted input, re-derive/verify it here.
  - Edge Cases: Grand Central applies Step 1.3's fallback consistently; a coordinate no longer matching current live data resolves to null (triggers a validation-error response in 2.3).
  - Files: src/lib/adapters/centerline.ts, src/lib/adapters/centerline.test.ts

  [FORCES]
  1. Server re-validation of untrusted client selection (ADR-0003) > trusting Phase 1's client-side selection data directly.
  ```

- [ ] **2.2 — Request validation module**

  ```text
  [SPEC]
  - Objective: Build src/lib/validation.ts: reject invalid coordinates, unsupported radii (only the server-owned fixed 50m accepted), unsupported periods (only 2025-01-01T00:00:00.000 inclusive to 2026-01-01T00:00:00.000 exclusive), unknown selection kinds, and any raw-SoQL-shaped input from the browser — all producing a structured validation error, no report created.
  - Inputs/Outputs: Input: raw POST body per docs/contract.md. Output: a discriminated-union result (valid parsed request | validation error + reason code), consumed by 2.3.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: One unit test per PRD §13 rejection case (bad coordinates, wrong radius, wrong period, unknown selection kind, raw-SoQL-shaped field) plus one happy-path test; the PRD §13 spatial coordinate-order/radius-unit test (lat/lng order, meters not feet/degrees) as an explicit case.
  - Constraints: Radius and period are compared against server-owned constants — a request supplying matching values doesn't grant authority; the server always uses its own configured values, never the client's.
  - Edge Cases: A radius field of `"50.0"` (string) vs. `50` (number) — decide and test the coercion rule; a period using an equivalent-but-different ISO format.
  - Files: src/lib/validation.ts, src/lib/validation.test.ts

  [FORCES]
  1. Server-owned radius/period as non-negotiable constants (never client-trusted) > accepting client-supplied values that happen to match.
  ```

- [ ] **2.3 — `POST /api/reports/intersection` route skeleton + 400 handling**

  ```text
  [SPEC]
  - Objective: Build src/app/api/reports/intersection/route.ts wiring 2.2's validation and 2.1's centerline resolution: parse, validate, resolve; return HTTP 400 + structured error body (no report created) on any failure; on success, return a placeholder response shape matching docs/contract.md (aggregation lands in 2.4-2.7) so the endpoint contract is testable before the full pipeline exists.
  - Inputs/Outputs: Input: HTTP POST body. Output: 400 + error body for invalid input; placeholder success-path response for valid input.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Route handler test covering every PRD §13 rejection case returns exactly HTTP 400 with no side effects; valid input reaches the placeholder success path.
  - Constraints: No rejection case from 2.2 may silently succeed — each must round-trip through the actual HTTP layer.
  - Edge Cases: Malformed/unparseable JSON body → 400, not a 500.
  - Files: src/app/api/reports/intersection/route.ts, src/app/api/reports/intersection/route.test.ts

  [FORCES]
  1. Fail closed (400, no report) on any invalid/untrusted input > permissive parsing for developer convenience.
  ```

- [ ] **2.4 — Collision adapter + query builder**

  ```text
  [SPEC]
  - Objective: Build src/lib/adapters/collisions.ts: query h9gi-nx95 with `within_circle(location, latitude, longitude, 50)` AND `crash_date >= '2025-01-01T00:00:00.000'` AND `crash_date < '2026-01-01T00:00:00.000'` AND `location IS NOT NULL`, fetching the fields listed in docs/knowledge-base/dataset-crashes.md; never fetch-all-then-filter.
  - Inputs/Outputs: Input: the validated coordinate from 2.1/2.3. Output: a typed adapter result for 2.5, covering PRD §13's fixture set: success, zero rows, malformed numeric values, missing labels, timeout, rate limit, invalid JSON.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Unit tests against both PRD §12 fixtures using mocked Socrata responses reproducing the documented row data, plus one test per PRD §13 adapter fixture category, each asserting a typed error/degraded result rather than an uncaught throw.
  - Constraints: Query string uses the server-owned 50m radius and 2025 date bounds only — never request parameters. Support the `SOCRATA_APP_TOKEN` header per docs/infra.md (works without one at demo volume, but the adapter should support it).
  - Edge Cases: on_street_name/off_street_name/cross_street_name are mutually exclusive per row (E 42 ST fixture has 3/9 missing on_street_name); location null-rate (10.6%) and borough null-rate (30.5%) must never gate computation — never filter/gate on borough.
  - Files: src/lib/adapters/collisions.ts, src/lib/adapters/collisions.test.ts

  [FORCES]
  1. Server-owned query parameters (radius, date bounds) baked into the adapter > flexible/parameterized query building.
  ```

- [ ] **2.5 — Deterministic aggregation (totals, road-user breakdown, contributing-factor ranking)**

  ```text
  [SPEC]
  - Objective: Build the aggregation in src/lib/report.ts: total crashes, total injured/killed, per-road-user (pedestrian/cyclist/motorist) injured/killed, and a ranked contributing-factor rollup across contributing_factor_vehicle_1..5 ("Unspecified" as its own labeled category, not excluded) from 2.4's raw rows — fully deterministic.
  - Inputs/Outputs: Input: raw rows from 2.4. Output: typed aggregation matching docs/contract.md's metrics shape; a genuinely missing value is `null`, never `0`; a successful zero-row query produces valid zero totals (neutral data, not "safe" — that's a UI concern).
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Unit tests reproducing both PRD §12 fixture outputs exactly from corresponding raw-row fixtures; a zero-rows test asserting valid zero (not null, not error); a malformed-numeric-value test asserting that field becomes `null`, not a crash or a silently wrong `0`.
  - Constraints: Pure/deterministic — no randomness or wall-clock dependence in computed values (the generated timestamp is a separate field, added in 2.7). Null-vs-zero is non-negotiable — test both directions explicitly.
  - Edge Cases: A row with all five contributing_factor fields blank must not silently vanish from the rollup denominator in a misleading way — decide and document how "no factor recorded" differs from "Unspecified".
  - Files: src/lib/report.ts, src/lib/report.test.ts

  [FORCES]
  1. Null-vs-zero correctness (non-negotiable) > compact/simplified aggregation code.
  ```

- [ ] **2.6 — Priority Zone fetch/cache + geometry-intersection join**

  ```text
  [SPEC]
  - Objective: Build src/lib/adapters/priority-zones.ts: fetch all 5 rows of qzji-nvbd once (long-lived cache, not per-request), and src/lib/geometry.ts's polygon-intersection function testing the request's 50m circle against each cached polygon (a real geometry op, not SoQL `within_polygon`, which is for points) — returning matched / not_matched / unavailable, never a zone name (dataset has no name/borough/ID/ranking column, per docs/knowledge-base/dataset-priority-zones.md).
  - Inputs/Outputs: Input: qzji-nvbd's 5 the_geom multipolygons (WGS84), the validated 50m circle. Output: the 3-state enum consumed by 2.7.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Unit test asserting qzji-nvbd is fetched at most once across multiple requests within the cache lifetime; geometry tests for a known circle-inside-polygon case (matched), a known circle-fully-outside-all-5 case (not_matched), and a fetch-failure case (unavailable); a test asserting the return type structurally cannot be anything but the 3 enum states.
  - Constraints: Authorizes a new geometry-library dependency (e.g. `@turf/turf`) for the polygon-intersection op — no hand-rolled algorithm without this authorization. Cache is process-lifetime or build-time, not re-fetched per request.
  - Edge Cases: A circle straddling a polygon boundary (partial overlap) must count as matched (any intersection, not full containment) — explicit boundary-straddle test.
  - Files: src/lib/adapters/priority-zones.ts, src/lib/geometry.ts, src/lib/adapters/priority-zones.test.ts, package.json

  [FORCES]
  1. Real geometry-intersection correctness (matched on any overlap, never a fabricated zone name) > reusing SoQL spatial operators unsuited to polygon-vs-polygon.
  ```

- [ ] **2.7 — Completeness/partial assembly + limitations + source provenance + route wiring**

  ```text
  [SPEC]
  - Objective: Complete src/lib/report.ts's assembly combining 2.5's metrics and 2.6's Priority Zone status into the full report object per docs/contract.md: report ID, generated timestamp, complete/partial status (partial if any source degraded), normalized selection/boundary/period echo, nullable metrics, Priority Zone status, limitations (e.g. "3 of 9 crash records missing on_street_name"), and source provenance for all 3 datasets (name, Socrata ID, role, retrieval status/time, query description). Wire into route.ts's success path, replacing 2.3's placeholder — HTTP 200.
  - Inputs/Outputs: Input: 2.1's resolved selection, 2.4/2.5's collision aggregation + adapter status, 2.6's Priority Zone status + adapter status. Output: full 200 response matching docs/contract.md.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Route-level integration tests reproducing both PRD §12 fixtures end-to-end (mocked adapters returning the documented data) asserting the full response body matches exactly; a partial-status test forcing the Priority Zone adapter to "unavailable" and asserting response status "partial" + a corresponding limitation + source marked unavailable; a provenance test asserting all 3 real Socrata IDs (inkn-q76z, h9gi-nx95, qzji-nvbd) appear.
  - Constraints: Status must be "partial" whenever any adapter degraded — never silently "complete". Source provenance must use real dataset IDs, never a placeholder.
  - Edge Cases: Both collision and priority-zone adapters degrading simultaneously still yields one "partial" status (not a "double-partial" state) with both limitations listed.
  - Files: src/lib/report.ts, src/app/api/reports/intersection/route.ts, src/lib/report.test.ts, src/app/api/reports/intersection/route.test.ts

  [FORCES]
  1. Honest partial-status disclosure over any single degraded source > presenting a best-effort "complete" report.
  ```

**Infra checkpoint (hirekarl):** provision `SOCRATA_APP_TOKEN` as a Vercel env var (dev/preview/prod, per `docs/infra.md`) before Step 2.4 is deployed to preview. Draft PR opened at Phase 2 branch creation; Vercel preview sanity-checked after Step 2.3 (proper 400s) and again after Step 2.7 (full 200 path with real fixture data). CI green (lint/format/test/90% coverage/build) required before merge.

---

## Phase 3 — Integration (owner: rhaeyyan)

Gated on Phase 1 Step 1.9 **and** Phase 2 Step 2.7 both merged.

- [ ] **3.1 — Wire frontend to the real backend, remove mock**

  ```text
  [SPEC]
  - Objective: Replace ReportPanel's/page.tsx's use of src/lib/mocks/report.mock.ts with a real fetch to POST /api/reports/intersection, triggered on user confirm after selection, sending the locked selection + boundary + period per docs/contract.md.
  - Inputs/Outputs: Input: Step 1.4's selected intersection, Step 2.7's live route. Output: ReportPanel driven by the real fetch's response/error, reusing Step 1.5's state machine unmodified.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Integration test (mocking fetch against the route handler) asserting a full select → confirm → loading → complete cycle renders real response data; a second test asserting a validation-error response surfaces the validation-error state, not a crash.
  - Constraints: Do not delete report.mock.ts — it stays useful for Phase 1-style component tests. Only the live composition (page.tsx) switches to the real fetch.
  - Edge Cases: Reselecting a new intersection while a request is in flight — a late-arriving response for the old selection must not overwrite the panel for the newer selection.
  - Files: src/app/page.tsx, src/components/ReportPanel.tsx, src/components/ReportPanel.test.tsx

  [FORCES]
  1. Reusing Step 1.5's already-built state machine unmodified > rebuilding fetch/state logic during integration.
  ```

- [ ] **3.2 — Reconcile contract drift**

  ```text
  [SPEC]
  - Objective: Compare the real Phase 2 response shape against docs/contract.md field-by-field; fix drift (naming, enum values, nullability) on whichever side is wrong relative to docs/contract.md, or amend docs/contract.md if backend surfaced a legitimate necessary addition; re-run Step 1.6/1.8's fixture-value assertions against the live route to confirm no silent value drift.
  - Inputs/Outputs: Input: docs/contract.md, the live route's 200 body, ReportPanel's field usage. Output: fixes or a documented contract.md amendment; a passing test proving both PRD §12 fixtures render identical numbers live as they did against the Phase 1 mock.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: Integration/e2e test asserting the live-route-driven ReportPanel renders the exact same fixture numbers Step 1.6's mock-driven test asserted for both fixtures — a diff-of-zero check between mock-driven and live-driven rendering.
  - Constraints: Prefer fixing the deviating side over ad hoc coercion at the call site — avoid one-off mapping patches in page.tsx.
  - Edge Cases: A drifted enum value (e.g. Priority Zone status casing) should be fixed at the shared type/adapter level, not per call site.
  - Files: docs/contract.md, src/types/report.ts, src/lib/report.ts, e2e/report-flow.spec.ts

  [FORCES]
  1. Single enum/type definition shared by mock and live data > divergent ad hoc mappings per call site.
  ```

- [ ] **3.3 — End-to-end happy-path Playwright flow**

  ```text
  [SPEC]
  - Objective: Build e2e/report-flow.spec.ts covering PRD §13's UI smoke test: load map → hover an intersection (see street names) → click to select and see the 50m boundary → confirm/request report → loading → complete state → inspect the sources list → trigger print/download → assert rendered values match one of the two PRD §12 fixtures via the live backend.
  - Inputs/Outputs: Input: running app (dev or preview) with the real Phase 2 backend. Output: a passing Playwright spec covering the full journey.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: The spec itself, green against a live/preview instance, with assertions at each named step.
  - Constraints: Exercise the real intersection dataset (not a stubbed route) to catch true end-to-end drift — seed a known-stable fixture selection (W 40 ST at 5 AVE) rather than a live-search-dependent one.
  - Edge Cases: Flaky Socrata network calls during e2e — add retry/backoff in the test harness itself, not the app, to reduce CI flakiness without masking real bugs.
  - Files: e2e/report-flow.spec.ts

  [FORCES]
  1. True end-to-end fidelity (real dataset, real API) > faster but less-trustworthy stubbed e2e runs.
  ```

- [ ] **3.4 — Failure/partial smoke test**

  ```text
  [SPEC]
  - Objective: Add an e2e test exercising the source-unavailable path: simulate one adapter (e.g. Priority Zone) failing/timing out via network-layer interception in the test harness, confirm the UI shows a visible "partial" label with the correct limitation text, and confirm a functional retry affordance.
  - Inputs/Outputs: Input: a network-layer failure injection in the e2e harness. Output: a passing test asserting partial-label visibility and retry behavior.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: e2e test asserting (1) partial status is visible, never silently treated as complete, (2) the limitation naming the failed source is visible, (3) retry re-issues the request and reaches complete once the simulated failure clears.
  - Constraints: Prefer network-layer interception over adding an in-app "fail on demand" flag, so no test-only branches leak into production adapter logic.
  - Edge Cases: A successful retry must fully replace partial data with complete data, not leave stale partial fields merged in.
  - Files: e2e/report-flow.spec.ts

  [FORCES]
  1. Honest partial-status UX verified end-to-end > relying solely on Phase 2's unit-level partial-status test.
  ```

- [ ] **3.5 — Verify both PRD §12 acceptance fixtures end-to-end with exact numbers**

  ```text
  [SPEC]
  - Objective: Add an explicit test (or extend 3.3) asserting both PRD §12 fixtures — W 40 ST at 5 AVE and E 42 ST at PARK AVE — produce their exact documented numbers driven fully through the real UI → real API → real Socrata data path (no mocks at any layer). This is the plan's final correctness gate before sign-off.
  - Inputs/Outputs: Input: the two named intersections, the live app. Output: a test asserting exact rendered metric values equal the documented PRD §12 numbers for both fixtures.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: The test itself — green against a live/preview deployment, exact values for both fixtures (not ranges).
  - Constraints: Do not weaken assertions to "greater than zero" — assert exact documented values.
  - Edge Cases: If live data has diverged from the documented numbers (a dataset revision since 2026-08-15), treat this as a blocking finding to escalate to hirekarl/reviewer rather than loosening the test.
  - Files: e2e/report-flow.spec.ts

  [FORCES]
  1. Exact-value acceptance verification > approximate/smoke-level assertions.
  ```

- [ ] **3.6 — Full axe scan on the completed page**

  ```text
  [SPEC]
  - Objective: Run a final @axe-core/playwright scan on the fully composed, live-data-driven page (map + panel + report hierarchy + print view) covering states not reachable in Phase 1's isolated component-level scans (real complete/partial data density).
  - Inputs/Outputs: Input: live app in complete and partial states. Output: zero new axe violations, or a documented/justified exception.
  - Bounded-AI boundary: N/A — no AI in this step.
  - Verification Oracle: An axe scan assertion (in e2e/report-flow.spec.ts or a dedicated a11y spec) with zero violations across both complete and partial states.
  - Constraints: Any violation not caught by Phase 1's component-level scans must be fixed, not suppressed, unless genuinely out of scope with written justification.
  - Edge Cases: Long contributing-factor/limitations lists with real data may reveal layout-dependent issues invisible with short mocks.
  - Files: e2e/report-flow.spec.ts, src/components/ReportPanel.tsx

  [FORCES]
  1. Real-data accessibility verification > relying solely on Phase 1's mock-data axe scans.
  ```

**Infra checkpoint (hirekarl):** draft PR opened at Phase 3 branch creation; Vercel preview verified after Step 3.1 (live wiring) and again after Step 3.5 (fixtures pass). CI green required for merge. After the Phase 3 PR merges (rebase merge, branch auto-deleted), promote to production and run a manual production smoke check reproducing both PRD §12 fixtures. Run the `devpost-submission-checklist` skill as the last step before the Sunday, August 16, 2026, 2:00 PM ET deadline. Separately (non-blocking), fix CLAUDE.md's stale "not yet linked to Vercel" line, flagged in Step 0.3.

---

## Verification summary

- Every step names its own Verification Oracle (unit/component/route/e2e) per `CLAUDE.md`'s `tech-lead → sdet → builder` loop — `sdet` writes the red before `builder` implements, then audits with `npm run test` (≥90% coverage gate), `npm run lint`, and `npm run build`.
- Phase 1 is verifiable in isolation against mocks (Steps 1.1-1.9) before any backend code exists.
- Phase 2 is verifiable in isolation against mocked adapter responses reproducing the two PRD §12 fixtures (Steps 2.1-2.7) before frontend integration.
- Phase 3's final gate (Step 3.5) is the only point where the two PRD §12 acceptance fixtures must reproduce their exact documented numbers through the complete, unmocked, live-data path — this is the plan's end-to-end proof that the app works.
- `npm run test:e2e` (Playwright + axe) is the oracle for every interaction/DOM-layer and accessibility claim; `npm run test` (vitest) is the oracle for everything else.
