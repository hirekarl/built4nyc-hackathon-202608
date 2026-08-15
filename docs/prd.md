# Product Requirements Document: EZStreet

Status: accepted product direction, pre-implementation. This PRD is the source of truth for product scope, user behavior, and the frontend interface. ADRs define the accepted technical boundaries. Knowledge-base files provide source evidence and implementation details.

## 1. Product thesis

A New Yorker can select one official street intersection and receive a clear, downloadable safety report grounded in NYC Open Data.

EZStreet converts an official centerline node into a visible 50-meter analysis boundary, queries collision points inside it, and computes every factual result deterministically. The product reports what the sources contain, identifies missing data, and does not claim that an intersection is safe or unsafe.

## 2. Problem

NYC collision and street data are public, but residents must understand several datasets and geospatial queries to answer a local question such as “What crashes were reported around this intersection last year?” Existing raw-data tools do not turn that work into a concise, sourced report that can be understood and shared.

## 3. Current implementation slice

The first slice covers one selected official intersection, a fixed 50-meter radius, and calendar year 2025.

### Included

- Load official street centerlines for the current map viewport.
- Make ordinary physical surface-street intersections hoverable and selectable.
- Show the selected intersection's official names and a visible 50-meter circle.
- Query Motor Vehicle Collisions - Crashes within the circle and date interval.
- Compute crash, injury, death, road-user, and contributing-factor metrics deterministically.
- Check whether the boundary intersects a Vision Zero Priority Area.
- Show report completeness, limitations, and source provenance.
- Print or download the same report object displayed on screen.
- Deploy a working public demo on Vercel.

### Not included

- Freehand polygon selection.
- Street-segment buffer analysis; test later only if the intersection flow is insufficient.
- Petition or permit generation.
- User-written observations.
- Saved reports, accounts, authentication, or a database.
- Editable PDF output or a finalized government-report format.
- A custom Street View person.
- AI calculation, scoring, causation claims, or safety recommendations.

The optional features above must not delay or weaken the map-to-report flow.

## 4. Primary user and outcome

The primary user is a New Yorker who wants credible, location-specific street-safety information without learning GIS or the NYC Open Data API.

The successful outcome is a report that answers:

- Which official intersection and boundary were analyzed?
- Which complete calendar year was used?
- How many crashes, injuries, and deaths were reported?
- How were pedestrians, cyclists, and motorists affected?
- Which contributing factors were most often recorded?
- Did the boundary overlap a DOT Vision Zero priority area?
- Which sources and limitations apply?

## 5. Core user flow

1. The app opens on a map focused on the Bryant Park and Grand Central area.
2. The app loads eligible official centerlines for the visible viewport.
3. Hovering over an eligible intersection highlights its hit target and shows its official street names.
4. Clicking selects one intersection and displays its name and 50-meter analysis circle.
5. The user confirms the selection and requests the report.
6. The server validates the locked selection, radius, and date interval.
7. The server queries NYC Open Data and computes the report without AI.
8. The interface displays the report status, facts, Priority Zone context, limitations, and sources.
9. The user can change the intersection, retry missing data, or print/download the report.
10. If implemented, the user may request a separate AI explanation or open Street View without changing the report facts.

## 6. Frontend interface specification

This section is the build contract for the initial frontend. A mockup may support it visually, but this specification takes priority if they conflict.

### 6.1 Layout

- Use a map-first, desktop-first layout.
- The map occupies the main viewport.
- A side panel contains guidance, the current selection, report controls, and report content.
- Keep map attribution visible.
- On narrow screens, the side panel becomes a bottom sheet or stacked panel without covering the selected intersection permanently.
- Do not require horizontal scrolling at supported viewport sizes.

### 6.2 Initial state

- Show the product name and one short instruction: select an intersection to create a safety report.
- Center the demo view on Midtown Manhattan between Bryant Park and Grand Central.
- Show eligible centerlines and intersection hit targets without overwhelming the basemap.
- Keep the report action disabled until an intersection is selected.

### 6.3 Hover and selection

- Hovering an eligible intersection changes its visual style and displays the official street names.
- The pointer cursor and visible focus treatment must indicate that the target is interactive.
- The interactive target may be larger than its visible marker; the verified spike used a 34-pixel hit target.
- Clicking or keyboard-activating an intersection selects it.
- Selection highlights the intersection and contributing streets and draws the 50-meter circle.
- The side panel shows the official display name, `Calendar year 2025`, and `50 meters (about 164 feet)` before analysis.
- A clear action lets the user remove or replace the selection.
- Selecting another intersection replaces the current selection and clears any prior report after confirmation or an unambiguous state transition.

### 6.4 Analysis states

- **Ready:** valid intersection selected; report action enabled.
- **Loading:** keep the selection and circle visible, disable duplicate requests, and show which data is being retrieved.
- **Complete:** show the complete report and retrieval time.
- **Partial:** show `Partial report` next to the report title, identify unavailable sources or fields, keep valid facts, and provide a retry action.
- **Zero matches:** say `No reported crashes matched this boundary and period`; do not describe the intersection as safe.
- **Validation error:** explain that the selection could not be analyzed and let the user choose another intersection.
- **Source failure:** never display a failed request as zero crashes or as no Priority Zone match.
- **Empty initial state:** do not show empty metric cards before the user requests a report.

Status must use text and an icon or shape in addition to color.

### 6.5 Report hierarchy

Display report information in this order:

1. Report title, `Complete` or `Partial`, intersection, 50-meter boundary, calendar year, and generated time.
2. Primary totals: crashes, people injured, and people killed.
3. Road-user breakdown: pedestrians, cyclists, and motorists injured and killed.
4. Ranked contributing factors and a separate count for `Unspecified`.
5. Priority Zone result: `Matched`, `Not matched`, or `Unavailable`. Do not display a zone name because dataset `qzji-nvbd` has none.
6. Data-quality notes and limitations.
7. NYC Open Data source names, dataset IDs, retrieval status, and links.
8. Print/download action.

Metric cards with missing values display `Unavailable`, not `0`, `N/A`, or an estimate.

### 6.6 Visual and accessibility direction

- Use a restrained civic-information style with high contrast and dense but readable report content.
- Reserve the strongest accent for the selected intersection and its boundary.
- Use consistent tokens for map hover, map selection, complete, partial, warning, and failure states.
- Do not use red/green color alone to communicate safety or status.
- All controls require visible labels, keyboard access, focus styles, and usable target sizes.
- The map needs a non-pointer way to activate a focused intersection.
- Screen-reader status announcements must cover loading, completion, partial results, errors, and selection changes.
- Run the repository's Playwright/axe accessibility check for the page.

### 6.7 Optional interface actions

- **Explain this report:** appears after a complete or partial factual report. Its output is labeled `AI explanation` and visually separated from `NYC Open Data facts`.
- **Street View:** opens visual context without changing the selected boundary or report. Missing imagery must not block the report.
- These actions remain optional features and may be omitted from the first working slice.

## 7. Analysis and report rules

### Selection

- Selection kind is `intersection`.
- Names and coordinates come from the official centerline selection, not user-entered location text.
- The server owns the allowed 50-meter radius.
- Eligible centerlines are ordinary physical surface streets. Exclude highways, tunnels, ramps, alleys, paths, non-pedestrian records, and nonphysical records.
- Load centerline geometry by map viewport rather than loading the city at once.

### Period

- Use `2025-01-01` inclusive through `2026-01-01` exclusive.
- Display `Calendar year 2025`.
- A later release may offer five-year or year-by-year analysis, but the MVP does not expose a date control.

### Required metrics

- Crashes.
- People injured and killed.
- Pedestrians injured and killed.
- Cyclists injured and killed.
- Motorists injured and killed.
- Ranked documented contributing factors.
- Count of `Unspecified` factors.
- Priority Zone overlap status.

### Completeness

- `Complete` means every required collision metric was computed and the Priority Zone check completed.
- `Partial` means the location and boundary are valid but a required source or metric is unavailable.
- A missing value is `null`, never zero.
- A successful query with no matching collision rows produces valid zero totals.
- Missing optional street labels create a limitation note but do not invalidate coordinate-based counts.
- The UI and download must render one shared report object and must not recalculate metrics independently.

## 8. Data sources

| Dataset | ID | Purpose | Access pattern |
| --- | --- | --- | --- |
| Motor Vehicle Collisions - Crashes | `h9gi-nx95` | Required report metrics | Server-side `within_circle` query for the selected coordinate, 50-meter radius, and 2025 interval |
| VZV Priority Zones or Areas | `qzji-nvbd` | Required contextual overlap result | Fetch and cache its five multipolygons; return matched, not matched, or unavailable |
| NYC Street Centerline | `inkn-q76z` | Selection geometry, official names, nodes, and physical IDs | Load eligible features by viewport and derive intersection candidates |

Never fetch the full collision table and filter it in the browser. A Socrata app token is optional for development but should be added through an ignored environment file if the team provisions one.

## 9. API contract

The planned route is `POST /api/reports/intersection`.

The request contains:

- schema version;
- locked intersection display name, coordinate, street names, and physical IDs;
- circle boundary with a 50-meter radius; and
- calendar-year 2025 start and exclusive end dates.

The response contains:

- report ID, generated time, and `complete` or `partial` status;
- normalized selection, boundary, and period;
- nullable deterministic metrics;
- Priority Zone status;
- data-quality notes and stable limitations;
- source names, dataset IDs, roles, retrieval status, times, and query descriptions.

Reject invalid coordinates, unsupported radii, unsupported periods, unknown selection kinds, and raw SoQL from the browser. ADR 0003 defines the boundary decision, and ADR 0005 defines deterministic reporting and bounded AI.

## 10. Optional AI explanation

The factual report does not depend on AI. If the team implements `Explain this report`:

- The action is explicitly triggered by the user.
- The model receives only the structured report object.
- The output briefly explains the strongest findings, period, 50-meter boundary, and limitations in plain language.
- The output cannot calculate or modify values, claim causation, call a place safe or unsafe, or hide a `Partial` status.
- The UI labels it `AI explanation` and keeps the factual report visible.
- If generation fails, the report remains usable and the explanation shows as unavailable.

The model/provider, environment-variable name, and access test remain implementation decisions. Do not build a multi-provider abstraction for the hackathon.

## 11. Print and download

- The initial export is a generic print-friendly report.
- The exported values and statuses must exactly match the displayed report object.
- The document includes the location, boundary, period, generation time, metrics, limitations, and sources.
- The exact civic-report format and editable export are deferred.
- ADR 0002 records the former petition-PDF decision and is superseded for the current product direction.

## 12. Acceptance cases

### Ordinary intersection

For `W 40 ST at 5 AVE`, 50 meters, calendar year 2025, the verified spike returned:

- 6 crashes;
- 7 people injured and 1 killed;
- 4 pedestrians injured and 1 killed;
- 1 cyclist injured and none killed; and
- 2 motorists injured and none killed.

### Complex intersection and missing labels

For `E 42 ST at PARK AVE`, 50 meters, calendar year 2025, the verified spike returned:

- 9 crashes;
- 4 people injured and none killed;
- 2 pedestrians injured;
- 2 cyclists injured; and
- 3 of 9 rows missing `on_street_name`.

The counts remain valid because all matched rows had coordinates. The interface must disclose the missing labels.

### Recovery cases

- Collision source timeout: collision values are unavailable, report is partial, and retry is visible.
- Priority Zone source timeout: collision facts remain visible, Priority Zone is unavailable, and report is partial.
- Successful zero-row query: all additive metrics are zero and the interface uses the required zero-match wording.
- Invalid coordinate or radius: return an HTTP 400 validation error and do not create a report.

## 13. Minimum validation

- Unit tests for aggregation, factor ranking, and completeness rules.
- Contract tests for validation and nullable response fields.
- Adapter fixtures for success, zero rows, malformed numeric values, missing labels, timeout, rate limit, and invalid JSON.
- A spatial test that catches swapped coordinate order or radius units.
- UI smoke test: select intersection, see boundary, generate report, inspect sources, and print/download matching values.
- Failure smoke test: unavailable source produces a visible partial label and retry.
- Keyboard and Playwright/axe checks for the primary page.
- Before handoff: lint, typecheck, unit tests, production build, and a manual browser check.

## 14. Success criteria

- The public demo completes intersection selection through sourced report without visible failure.
- The first 30 seconds show the official intersection, 50-meter boundary, and real NYC Open Data result.
- The submission explains that software computes the facts deterministically.
- Missing data produces a clear partial report instead of invented or misleading values.
- The NYC Open Data sources and dataset IDs are visible.
- The optional AI role, if shown, is clearly bounded and separate from the facts.
- A screenshot or recording can demonstrate the flow if the basemap or an external service fails during judging.

## 15. Open implementation decisions and safe deferrals

- Team ownership for map, data/report service, report UI, and optional AI work.
- Model provider and access verification for the optional explanation.
- Complex Grand Central naming fallback beyond the ordinary-intersection demo fixture.
- Socrata app-token provisioning.
- Final report visual format.
- Street View, custom person, petition, permit, user observations, street-line buffer, saved reports, and editable export.
