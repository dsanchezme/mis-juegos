# Contributing

This is a small personal project, so the workflow is deliberately light: one branch per change, a pull request, green checks, squash merge.

## Workflow

1. **Branch from `main`** with a short, descriptive name: `feat/online-mode`, `fix/shake-on-ios`, `chore/update-deps`.
2. **Commit small and often.** Use [Conventional Commits](https://www.conventionalcommits.org/) style for the subject line when it helps (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, `ci:`). Write it in the imperative: "add sancocho animation", not "added".
3. **Run `npm run check`** before pushing. It runs exactly what the `quality` CI job runs.
4. **Open a pull request** and fill in the template. Keep PRs focused on one thing.
5. **Wait for CI to be green.** Never merge on red, and never disable or skip a test to get to green: fix the cause.
6. **Squash and merge.** The PR title becomes the commit on `main`, so make it read well.
7. **Merging deploys.** `main` is always releasable: the merge triggers CI again and deploys to GitHub Pages only if every job passes.

## Git hooks

`npm install` installs two hooks via [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks):

- **pre-commit**: lints and formats the staged files with Biome.
- **pre-push**: type check and unit tests.

They are a fast local safety net; CI is the source of truth. If you ever need to bypass them (`--no-verify`), CI will still catch the problem.

## Code style

[Biome](https://biomejs.dev/) handles both linting and formatting, configured in `biome.json`. Don't argue with the formatter; run `npm run lint:fix`.

Beyond what the linter enforces:

- **Keep game rules pure.** Anything under `rules/` must not touch React, the DOM, storage or `Math.random`. Randomness comes in through a seed so every game is reproducible in tests.
- **UI reads state, rules change it.** Screens dispatch actions to `apply(state, action)`; they don't compute scores themselves.
- **Small functions with intention-revealing names.** Prefer a well-named helper over a comment explaining a block.
- **No non-null assertions (`!`).** Handle the missing case explicitly.
- **Buttons are `<button type="button">`.** Interactive elements must be real buttons or links so they work with a keyboard and screen readers.
- **Everything in the repository is in English**: identifiers, file names, comments, test names, commits and PRs. Spanish appears only as UI copy in `src/i18n/es.ts`.

## Tests

| Layer         | Tool                    | Where                                | What belongs there                                                           |
| ------------- | ----------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| Unit          | Vitest                  | `src/**/*.test.ts(x)`                | Game rules, scoring, engine helpers. Fast, many, exhaustive on edge cases.   |
| End-to-end    | Playwright (Pixel 7)    | `e2e/*.spec.ts`                      | A few critical journeys on the production build: start a game, roll, resume. |
| Accessibility | axe-core in Playwright  | `e2e/hub.spec.ts`                    | No serious or critical WCAG violations on key screens.                       |
| Database      | pgTAP (Supabase CLI)    | `supabase/tests/database/*.test.sql` | Row level security and every SQL function: who may read or change what.      |
| Online        | Vitest + local Supabase | `supabase/tests/functions/*.test.ts` | Phones playing through the real Edge Function: auth, turns, races.           |

Rules:

- **Every bug fix starts with a failing test** that reproduces it.
- **Every new rule gets a unit test** before or alongside the code.
- Coverage of `rules/` and `engine/` must stay at or above the thresholds in `vitest.config.ts` (90% lines, functions and statements; 85% branches). CI fails below that.
- **Every SQL function or policy gets a pgTAP test**, including the cases that must be rejected (outsiders, wrong role, bad input). Database changes are new files in `supabase/migrations/`; never edit a migration that is already on `main`.
- E2E tests fail on any browser console error, and `Math.random` is seeded so runs are reproducible. Select elements by role and accessible name, not CSS classes.

## Dependencies

- Add a dependency only when it clearly pays for itself; this app ships to phones, so bundle size matters.
- Commit `package-lock.json`. CI installs with `npm ci --ignore-scripts`, so dependencies never run install scripts.
- Dependabot opens grouped update PRs weekly (npm) and monthly (GitHub Actions). New releases wait 7 days before Dependabot proposes them.

## Recommended repository settings

These are one-time settings in GitHub that make the workflow enforceable:

- **Settings → Rules → Rulesets → New branch ruleset** targeting `main`:
  - Require a pull request before merging (0 approvals is fine for a solo project).
  - Require status checks to pass: `Lint, types, unit tests and build`, `End-to-end tests`, `Dependency audit`, `Dependency review`, `Analyze (javascript-typescript)`, `Analyze (actions)`.
  - Block force pushes. Restrict deletions.
- **Settings → General → Pull Requests**: allow squash merging only, and enable "Automatically delete head branches".
- **Settings → Pages → Source**: GitHub Actions.
- **Settings → Security** (Advanced Security): enable the dependency graph (required by the `Dependency review` check), Dependabot alerts, Dependabot security updates, secret scanning and push protection (all free for public repos).
