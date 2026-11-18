# Mis juegos

[![CI](https://github.com/dsanchezme/mis-juegos/actions/workflows/ci.yml/badge.svg)](https://github.com/dsanchezme/mis-juegos/actions/workflows/ci.yml)
[![CodeQL](https://github.com/dsanchezme/mis-juegos/actions/workflows/codeql.yml/badge.svg)](https://github.com/dsanchezme/mis-juegos/actions/workflows/codeql.yml)

A hub of digital board games played on a single phone, tablet or computer. It is an installable web app (PWA): it opens in any browser, installs like an app and works offline.

**Play it:** https://dsanchezme.github.io/mis-juegos/

## Games

- **Ambicioso**: dice, 2+ players. Roll 4 dice; ones and fives score, and so do three and four of a kind. If no die scores it's a _sancocho_ and you lose everything you built up that turn.

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

## Project structure

```
src/
  central/            hub screens: games, history, players, settings
  motor/              shared engine: game contract, seeded randomness, storage
  ui/                 dice, styles, sound and haptics, shake to roll, who goes first
  juegos/
    catalogo.ts       list of games shown in the hub
    ambicioso/
      reglas/         pure game logic and its unit tests
      pantallas/      game UI
e2e/                  end-to-end tests (Playwright)
```

Each game exposes its rules as a pure function, `aplicar(estado, accion)`. Rules are tested without any UI and, later on, online mode can run the very same rules on a server.

To add a game, create `src/juegos/<id>/` with `reglas/` and `pantallas/`, and register it in `src/juegos/catalogo.ts`.

## Quality and delivery

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow. In short:

- Every change goes through a pull request. CI must be green before merging.
- **CI** (`.github/workflows/ci.yml`) runs lint, type check, unit tests with a coverage threshold, the production build, end-to-end tests on a mobile viewport (including an accessibility scan), and a dependency audit.
- **CD**: every merge to `main` re-runs CI and, only if every job passes, deploys to GitHub Pages.
- **Security**: CodeQL code scanning, Dependabot updates, dependency review on PRs, actions pinned to commit SHAs, and least-privilege workflow permissions. See [SECURITY.md](SECURITY.md).

Everything is stored on the device (games, players, history). There is no server or database, so hosting is free.
