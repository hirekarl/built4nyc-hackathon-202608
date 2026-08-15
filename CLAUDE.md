# Built for NYC: AI Hackathon — Project Repo

This repo is the entry for the **Built for NYC: AI Hackathon**, presented by The New York Public Library (NYPL) and Major League Hacking (MLH), Aug 15–16, 2026, at the Stavros Niarchos Foundation Library (SNFL). Full source docs are in `docs/` (see `docs/README.md` for the index).

## The prompt

Using generative AI and "vibe coding," build a **web app** that meets a challenge NYC is facing (e.g. food deserts, park utilization, access to city resources). See `docs/official-rules.md` for the full prompt and rules.

## Hard constraints

- **Submission deadline: 2:00 PM ET, Sunday, August 16, 2026** — submit via Devpost at [on.nypl.org/hack-dev](https://on.nypl.org/hack-dev). No extensions.
- Judging criteria: adherence to the prompt, originality of concept, potential impact.
- Only one person per team can submit; that person is responsible for splitting any prize money.
- Full rules: `docs/official-rules.md`. Event logistics/WiFi/FAQ: `docs/important-info-and-faqs.md`. Agenda: `docs/overview-and-agenda.md`.

## Target tracks

- **General category** (default, all entrants).
- **Best Use of NYC Open Data** — must use a dataset from [opendata.cityofnewyork.us](https://opendata.cityofnewyork.us/) in a novel way. Use the `nyc-open-data-scout` agent to find and wire up a relevant dataset.

## Stack & workflow

- **Next.js (App Router)**, deployed on **Vercel**. Use the `vercel:*` skills already available in this environment (`vercel:bootstrap`, `vercel:deploy`, `vercel:nextjs`, `vercel:vercel-storage`, etc.) for anything Vercel/Next.js-specific — don't re-derive that guidance here.
- No project idea is locked in yet. Use the `idea-brainstormer` agent to converge on one scoped to a weekend build, ideally with a plausible NYC Open Data angle.
- Once scaffolding is needed, use the `scaffold-nextjs-app` skill, which also wires up the engineering standards below (hooks, lint/format config, test setup).
- Before submitting, run the `devpost-submission-checklist` skill.

## Git workflow

- **Feature branches + PRs only — never commit directly to `main`.** Branch from `main`, open a PR, merge via GitHub.
- **Rebase is the merge strategy**, enforced at the GitHub repo level (squash and merge-commit are disabled). Keep feature branches rebased on `main` before merging to avoid conflicts at merge time.
- Branches are auto-deleted on merge.

## Engineering standards

- **TDD, ≥90% test coverage.** Write the failing test before the implementation. Coverage is enforced in CI/pre-commit — treat a coverage drop below 90% as a build failure, not a warning.
- **LF line endings everywhere**, enforced via `.gitattributes` (`* text=auto eol=lf`) — don't bypass it.
- **Pre-commit hooks** (Husky, already installed) currently run lint-staged on `*.md` (`markdownlint-cli2` + `prettier --write`); `scaffold-nextjs-app` extends the same `lint-staged` config with the app's own lint/format, plus the full test suite before every commit. Don't commit with `--no-verify`; if a hook fails, fix the underlying issue.
- **Conventional Commits, enforced at commit time.** `.husky/commit-msg` runs `commitlint` (`commitlint.config.cjs`, extends `@commitlint/config-conventional`) — non-conventional commit messages (e.g. missing a `type:` prefix) are rejected.
- **No AI `Co-Authored-By` trailers.** The same `commit-msg` hook rejects any `Co-Authored-By:` trailer that names an AI tool (Claude, Anthropic, OpenAI, ChatGPT, GPT-, Copilot, Gemini, Codex, or the word "AI"). When Claude Code commits in this repo, it must not add its usual `Co-Authored-By: Claude ... <noreply@anthropic.com>` trailer — the hook will block it.
- **CI via GitHub Actions** (`.github/workflows/ci.yml`, set up by `scaffold-nextjs-app`) re-runs lint, format check, tests, and the ≥90% coverage gate on every push/PR — the pre-commit hook is a fast local gate, CI is the authoritative one. Keep them checking the same things.
- **SOLID + established design patterns** when architecting non-trivial modules — favor small, single-responsibility components/functions, dependency inversion at integration boundaries (e.g. the Open Data client behind an interface, not fetch calls scattered through components), and named patterns (factory, strategy, adapter, etc.) where they clarify intent. Don't apply patterns ceremonially to trivial code — a weekend hackathon app still favors the simplest thing that satisfies SOLID, not maximal abstraction.
- **Markdown lint + format** (repo root already set up, works today — no app scaffold needed): `npm run lint:md` (markdownlint-cli2, config at `.markdownlint-cli2.jsonc`, with an `MD041` override in `.claude/.markdownlint-cli2.jsonc` for frontmatter-led agent/skill files) and `npm run format:md` (Prettier, `.prettierrc.json` sets `proseWrap: "never"` so paragraphs stay on one unwrapped line instead of hard-wrapping — GFM tables are supported natively and get column-aligned on format). Both are wired into pre-commit/CI alongside the app's own lint/format/test once `scaffold-nextjs-app` runs.

## Notes

- This is a weekend hackathon repo, not a long-lived codebase — favor speed and a working demo over architectural polish.
- Don't prescribe app structure here; it doesn't exist yet. Update this file once the idea and scaffold are in place if there's project-specific context worth persisting (e.g. the chosen Open Data dataset, key routes).
