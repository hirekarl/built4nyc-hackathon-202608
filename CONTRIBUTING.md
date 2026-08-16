# Contributing to EZStreet

EZStreet was built for a weekend hackathon, but the workflow below is enforced by hooks and CI rather than convention — so it's worth reading before your first commit.

For the full engineering standards and the multi-agent build workflow, see [`CLAUDE.md`](./CLAUDE.md) (Claude Code) or [`AGENTS.md`](./AGENTS.md) (Codex CLI). They are kept in sync; change both when a rule changes.

## Prerequisites

**Node ≥22** and **npm ≥12**, pinned via `.nvmrc` and `package.json` `engines`.

An older npm — including the 10.9.x that some Node 22 installs bundle — silently drops `libc` metadata from `package-lock.json` and reintroduces lockfile drift. Check `npm -v` before regenerating the lockfile, and run `npm install -g npm@latest` if it's below 12.

```bash
nvm use          # or: fnm use
npm ci
npm run dev
```

## Branching and pull requests

- **Feature branches and pull requests only — never commit directly to `main`.**
- **Rebase is the merge strategy.** Squash and merge-commit are disabled at the repository level. Keep your branch rebased on `main` before merging.
- Every pull request needs a human approving review and green CI.
- Branches are deleted automatically on merge.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), enforced at commit time by `commitlint` via `.husky/commit-msg`. A message without a `type:` prefix is rejected.

```text
feat: add priority zone overlap to the report
fix: stop the client redeclaring server constants
docs: correct the mock-versus-live claim in the contract
```

**Do not add AI `Co-Authored-By` trailers.** The same hook rejects any trailer naming an AI tool. Authorship stays with the people accountable for the code.

Don't commit with `--no-verify`. If a hook fails, fix the underlying issue.

## Tests

**Write the failing test before the implementation.** Coverage is enforced at **90%** on lines, functions, branches, and statements — a drop below the gate is a build failure, not a warning.

```bash
npm test              # vitest with coverage (the 90% gate)
npm run test:watch
npm run test:e2e:ci   # Playwright + axe — what CI's required e2e job runs
npm run test:e2e:live # the two exact-value tests against live NYC Open Data
```

The `@live-data` tests assert exact PRD §12 crash counts against `h9gi-nx95`, which NYPD backfills continuously. They are excluded from the merge gate on purpose — an upstream data edit shouldn't red an unrelated pull request. Run them on demand before a release or submission.

**Accessibility is tested, not assumed.** `@axe-core/playwright` asserts zero violations against the rendered page. Any new page or route should get the same scan added.

## Before you push

CI is the authoritative gate, and the pre-commit hook is deliberately narrower. In particular, **neither Vitest nor ESLint type-checks**, so a type error in a test file is invisible locally until you run:

```bash
npm run typecheck
npm run lint && npm run lint:md
npm run format:check && npm run format:md:check
npm run build
```

## Code style

- **LF line endings everywhere**, enforced via `.gitattributes`. Don't bypass it.
- Prettier and ESLint for app code; Prettier and markdownlint-cli2 for Markdown. `proseWrap` is `"never"` — paragraphs stay on one unwrapped line.
- Favor small, single-responsibility modules and dependency inversion at integration boundaries (the Open Data client sits behind an interface; `fetch` calls are not scattered through components). Don't apply patterns ceremonially — the simplest thing that stays SOLID wins.

## The one non-negotiable rule

**Every report fact is computed deterministically before any model call.** Crash counts, injury and fatality tallies, contributing-factor rollups, Priority Zone overlap, completeness status, and limitations are all deterministic. An optional model may receive a finished structured report and explain it in plain language. It must never compute or change a fact, claim causation or safety, hide a partial status, or control whether the factual report renders.

See [ADR-0005](./docs/adr/0005-deterministic-report-and-bounded-ai.md).
