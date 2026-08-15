# Infra readiness notes

## Vercel project link

The Vercel project is already linked locally — `.vercel/project.json` exists and no `vercel link` (or `vercel:bootstrap` relink) is needed:

- `projectId`: `prj_WwONv6YDzuwPcVH6wbpcoToigEK8`
- `orgId`: `team_cDQvQDbC6zAtDDaayeZIeywF`
- Project name: `ezstreet`
- Framework: Next.js
- Node version: `24.x`

## Socrata app-token strategy

Per PRD §8, the crash dataset (`h9gi-nx95`), NYC Street Centerline (`inkn-q76z`), and VZV Priority Zones (`qzji-nvbd`) queries work without a Socrata app token at hackathon-demo volume, but a token raises rate limits and should be provisioned:

- Env var name: `SOCRATA_APP_TOKEN`.
- **Server-only** — no `NEXT_PUBLIC_` prefix. It must never be sent to the client bundle; only server-side adapters (Phase 2, `src/lib/adapters/*.ts`) read it.
- Must be added via `vercel env add SOCRATA_APP_TOKEN` (or the `vercel:env` skill) for **development, preview, and production** environments before Phase 2 Step 2.4's collision queries are deployed to preview/production. Local dev can proceed without it in the meantime — the adapter should work with or without the header, per Step 2.4's `[SPEC]`.

## Local env files

`.env.local` and `.vercel/.env.development.local` already exist on this machine and are gitignored (`.env*.local` and `.vercel` are both excluded in `.gitignore`). Do not commit their contents, and do not commit an actual token value anywhere in the repo.

## Known stale doc (non-blocking)

`CLAUDE.md`'s line stating the project is "**Not yet linked to a Vercel project locally** (no `.vercel/` in this checkout)" is stale — `.vercel/project.json` exists as documented above. This is flagged here as a non-blocking follow-up per the Phase 0 plan; it is not fixed in this step. The implementation plan's Phase 3 infra checkpoint is where this correction is scheduled to land.
