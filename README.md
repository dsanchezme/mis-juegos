# Mis juegos

[![CI](https://github.com/dsanchezme/mis-juegos/actions/workflows/ci.yml/badge.svg)](https://github.com/dsanchezme/mis-juegos/actions/workflows/ci.yml)
[![CodeQL](https://github.com/dsanchezme/mis-juegos/actions/workflows/codeql.yml/badge.svg)](https://github.com/dsanchezme/mis-juegos/actions/workflows/codeql.yml)

A hub of digital board games played on a single phone, tablet or computer. It is an installable web app (PWA): it opens in any browser, installs like an app and works offline. It is available in Spanish and English.

**Play it:** https://dsanchezme.github.io/mis-juegos/

## Games

- **Ambicioso** (_Greed_ in English): dice, 2+ players. Roll 4 dice; ones and fives score, and so do three and four of a kind. If no die scores it's a _sancocho_ (a bust) and you lose everything you built up that turn.

## Getting started

Requires Node.js 22 (see `.nvmrc`).

```bash
npm install          # also installs the git hooks
npm run dev          # http://localhost:5173/mis-juegos/
```

| Command                 | What it does                                                |
| ----------------------- | ----------------------------------------------------------- |
| `npm run dev`           | Dev server with hot reload                                  |
| `npm test`              | Unit tests (Vitest)                                         |
| `npm run test:watch`    | Unit tests in watch mode                                    |
| `npm run test:coverage` | Unit tests with coverage report in `coverage/`              |
| `npm run test:e2e`      | End-to-end tests (Playwright) against the production build  |
| `npm run lint`          | Lint and format check (Biome)                               |
| `npm run lint:fix`      | Apply safe lint fixes and format                            |
| `npm run typecheck`     | TypeScript type check                                       |
| `npm run check`         | Everything CI checks except e2e: run it before opening a PR |
| `npm run build`         | Production build in `dist/`                                 |

The first time you run e2e tests locally, install the browser with `npx playwright install chromium`.

## Online play (in development)

Online rooms use [Supabase](https://supabase.com) (Postgres, anonymous sign-in and Realtime). The app does not use it yet; the design is in the project's design notes. Everything is defined in `supabase/` and runs locally in Docker, so you never create tables by hand in the cloud.

| Command                   | What it does                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run db:start`        | Bundle the Edge Function, start the local Supabase stack (needs Docker) and apply migrations |
| `npm run db:reset`        | Recreate the local database from `supabase/migrations`                                       |
| `npm run db:test`         | Database tests (pgTAP) in `supabase/tests/database`                                          |
| `npm run db:lint`         | Lint the SQL in the `online` schema                                                          |
| `npm run test:online`     | Play through the Edge Function as several phones (needs `db:start`)                          |
| `npm run build:functions` | Re-bundle `src/online/` into the Edge Function after changing it                             |
| `npm run db:stop`         | Stop the local stack                                                                         |

```
supabase/
  config.toml         local stack settings (anonymous sign-in on, `online` schema exposed)
  migrations/         schema changes, applied in order; never edit one that is merged
  functions/
    room-action/      Edge Function for game moves (thin Deno wrapper; core.js is generated)
  tests/database/     pgTAP tests: row level security, lobby rules, saving moves
  tests/functions/    online tests: real sign-ins, SQL functions and the Edge Function together
```

How it is secured:

- All tables live in the `online` schema with row level security. Players can only **read** rooms they belong to.
- Clients never write tables directly. Lobby changes go through SQL functions (`create_room`, `join_room`, `add_seat`, `remove_seat`, `update_config`, `leave_room`) that check who is calling.
- Game moves (`START`, `ROLL`, `BANK`, `SKIP_TURN`, `REMOVE_PLAYER`, `REMATCH`) go through the `room-action` Edge Function. The server rolls the dice with a cryptographic generator, so no phone can predict or fake a roll, and it runs the same `apply()` as the single-phone game. Its logic is plain TypeScript in `src/online/` (unit tested with Vitest) bundled into the function.
- Every move carries the room `version` the phone saw. A move based on an older version is refused, and the save is atomic (`commit_action`), so a double tap or two phones at once never apply twice.
- A phone (`room_members`) can control several players (`room_seats`), for pass-and-play inside an online room.

## Project structure

```
src/
  hub/                hub screens: games, history, players, settings
  engine/             shared engine: game contract, seeded randomness, storage and its migrations
  ui/                 dice, styles, sound and haptics, shake to roll, who goes first
  i18n/               Spanish and English texts, and the language hook
  online/             online server logic (run by the Edge Function): room moves, dice, HTTP handler
  games/
    catalog.ts        list of games shown in the hub
    ambicioso/
      rules/          pure game logic and its unit tests
      screens/        game UI
e2e/                  end-to-end tests (Playwright)
```

Each game exposes its rules as a pure function, `apply(state, action)`. Rules are tested without any UI and, later on, online mode can run the very same rules on a server.

To add a game, create `src/games/<id>/` with `rules/` and `screens/`, add its texts to both language files, and register it in `src/games/catalog.ts`.

## Languages

All user-facing text lives in `src/i18n/es.ts` and `src/i18n/en.ts`; components never hard-code strings. Read them with the `useT()` hook and format numbers with `fmt()`, which follows the chosen language (5.000 in Spanish, 5,000 in English).

- The player picks the language in **Settings**. Until they do, the app follows the device language (Spanish for any `es-*` locale, English otherwise).
- `en.ts` is typed against `es.ts`, so a missing or misspelled key fails the type check.
- Translations are written to read naturally, not word for word. English uses the usual dice-game terms: _bank_ (plantarse), _bust_ (sancocho), _hot dice_ (mano llena).
- Rules return data, not sentences (for example, the scoring parts of a roll), and the UI turns that data into text in the current language. Keep it that way so saved games and history display correctly after a language change.
- All code is in English: identifiers, file names, comments, tests and documentation. Only the Spanish UI copy in `es.ts` is in Spanish. Game ids such as `ambicioso` stay as they are because saved data uses them.
- Saved data lives in `localStorage` under the `mis-juegos:` prefix. If you rename a stored key or field, add a step to `src/engine/migrate.ts` so players keep their history.

## Quality and delivery

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow. In short:

- Every change goes through a pull request. CI must be green before merging.
- **CI** (`.github/workflows/ci.yml`) runs lint, type check, unit tests with a coverage threshold, the production build, end-to-end tests on a mobile viewport (including an accessibility scan), database migrations and security tests against a local Supabase, and a dependency audit.
- **CD**: every merge to `main` re-runs CI and, only if every job passes, deploys to GitHub Pages.
- **Security**: CodeQL code scanning, Dependabot updates, dependency review on PRs, actions pinned to commit SHAs, and least-privilege workflow permissions. See [SECURITY.md](SECURITY.md).

Single-phone games store everything on the device (games, players, history) and need no server. Online play will use the free Supabase plan, so hosting stays free.
