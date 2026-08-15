---
type: regulation
status: candidate — not yet wired into the petition-generation prompt
source: NYC DOT Open Streets program rules (Title 34 §4-21) and the 2026 ArcGIS Survey123 application, research pass 2026-08-15
---

# NYC DOT Open Streets 2026 application requirements

What the petition draft actually needs to get right to read as a credible Open Streets application, not a generic complaint letter. Distilled from a much longer research pass — the omitted material (SAPO permitting, CGL insurance minimums, PSEP grant partners, subconcession/exclusive-seating economics, capital redesigns like 34th Avenue's "Paseo Park") is real but has no bearing on a stateless petition-drafting MVP; cut rather than carried forward as unused context.

The product-level AI guardrails (data-grounded prompting, human-in-the-loop editing, no auto-submission) are already specified in [PRD §7](../prd.md#7-ai-usage) — not repeated here, this file is the regulatory content those guardrails operate on.

## Typologies — the petition must target exactly one

| Typology | Vehicular access | Bus/truck route siting | Hours |
| --- | --- | --- | --- |
| **Limited Local Access** | Local parking, deliveries, Access-A-Ride, emergency only — 5 MPH | Strictly prohibited | Flexible, custom weekly schedule |
| **Full Closure** | None (except emergency response) | Weekends only (Sat–Sun, 9 AM–12 AM) | 9:00 AM–12:00 AM |
| **Full Closure: Schools** | None during operational hours | Strictly prohibited, any time | School days only, 7:00 AM–6:00 PM |

The LLM should pick the typology implied by the drawn area's context (or ask, if genuinely ambiguous) and write the letter against that specific typology's rules — not generic "close this street" language.

## Site plan mandates — cite these to demonstrate operational competence

- **Emergency access lane:** continuous, 15-foot wide, and a "straight shot" — no meander or curve for the full length. This is a hard FDNY swept-path requirement, not a suggestion.
- **Crosswalk daylighting setback:** 8 feet from all crosswalks.
- **Fire hydrant clearance:** 15 feet.
- **Temporary structures** (tents, shade canopies): weighted bases, not stakes; capped at 400 sq ft per structure or tied-together cluster.

## Friction points to preempt in the letter

- **EMS response time:** DOT's own data ties reduced ambient traffic/double-parking to _faster_ EMS response (a ~63–70 second improvement was measured city-wide after a comparable traffic-volume reduction) — cite this to rebut the standard "this will slow down emergency vehicles" objection, provided the emergency lane mandate above is stated as met.
- **ADA / Access-A-Ride:** barricades must be easily movable for Access-A-Ride vehicles; commit to staff trained to assist people with visual impairments navigating the loss of a curb/roadway tactile boundary. This is not optional context — it's a response to active federal litigation (_Charles v. City of New York_, _Disability Rights New York v. City of New York_) challenging the program on exactly this point.
- **DSNY sanitation timing:** residential waste (55-gallon containerized bins) hits the curb at 6:00 PM (1–9 unit buildings) or 8:00 PM (10+ units) — squarely inside most Open Streets' evening operating hours. The letter should note a coordination plan that keeps bin placement clear of the 15-foot emergency lane and active programming area.

## Eligibility

- **Eligible primary partners:** community-based organizations (formal or informal — block associations, BIDs, civic groups, nonprofits), educational institutions, commercial coalitions, houses of worship.
- **Ineligible as sole partner:** isolated for-profit entities, single-day event organizers (route to SAPO instead — out of scope for this app).
- **New Open Streets** (no prior operating history) need 3 formal Letters of Support from a diverse set of stakeholders — elected officials, the Community Board, adjacent property owners, neighboring institutions. The letter should note this as a next step for the user, not something the app itself generates.

## Why it matters for this project

This is what separates a petition that reads as researched from one that reads as a form letter: naming the correct typology, citing the exact numeric mandates (15 ft, 8 ft, 400 sq ft) as evidence the applicant understands the compliance bar, and preempting the three objections DOT reviewers actually raise (emergency access, ADA, sanitation) rather than leaving them for the reviewer to find. All of it is static, deterministic reference content — safe to hand the LLM as prompt context, since none of it is user-specific data that needs computing.

Used by: [PRD §7](../prd.md#7-ai-usage) (once the petition-generation prompt template is implemented).
