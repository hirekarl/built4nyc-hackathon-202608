---
name: devpost-submission-checklist
description: Walk through final-submission readiness against the Built for NYC AI Hackathon official rules before submitting on Devpost. Use as the last step before the Sunday 2:00 PM ET deadline.
---

Check the project against the actual rules in `docs/official-rules.md` before submitting at [on.nypl.org/hack-dev](https://on.nypl.org/hack-dev). Walk through each item with the user and don't mark it done until confirmed:

1. **Deadline awareness.** Confirm the current time is before 2:00 PM ET, Sunday, August 16, 2026 — this is a hard cutoff, no late submissions.
2. **App is live and demoable.** The Vercel deployment works end-to-end for the core feature — not just `npm run dev` locally. Actually load the deployed URL and click through it.
3. **Track selection.** Confirm which track(s) are being entered: General (default for everyone) and, if applicable, Best Use of NYC Open Data. If claiming the Open Data track, confirm the submission write-up explicitly names the dataset and states the "novel" use (per `nyc-open-data-scout`'s output) — judges won't infer it from the code alone.
4. **Submission content** matches what Devpost's form will ask for: project name, short description tying it to a specific NYC challenge (per the prompt in `docs/official-rules.md`), screenshots or a short demo video, and the live URL / repo link.
5. **Single submitter.** If working as a team, confirm only one person is submitting on Devpost, and that there's a clear understanding among teammates of how any prize money would be split (per `docs/important-info-and-faqs.md`) — this isn't enforced by Devpost, so it has to be handled socially now.
6. **CI is green.** Lint, format, and the ≥90% coverage test suite pass on the latest commit (`.github/workflows/ci.yml`) — don't submit on top of a broken build.
7. **In-person requirement.** Confirm the submitter checked in on-site on Saturday and will be present for judging starting 2:15 PM Sunday, August 16 — remote work in between is fine, but presence at open/judging is required.

End with an explicit go/no-go: only call it "ready to submit" once every item above is confirmed, not assumed.
