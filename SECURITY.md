# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Report them privately through [GitHub's private vulnerability reporting](https://github.com/dsanchezme/mis-juegos/security/advisories/new). You'll get an answer as soon as possible; this is a personal project maintained in spare time.

## Supported versions

Only the version currently deployed from `main` is supported.

## How the project stays secure

- The app is a static site with no backend and no accounts. All data stays in the browser's local storage on the player's device.
- CI runs with read-only permissions by default; only the deploy job can write to GitHub Pages.
- Third-party GitHub Actions are pinned to full commit SHAs, and checkouts don't persist credentials.
- Dependencies are installed with `npm ci --ignore-scripts`, audited on every run (`npm audit`, registry signatures), reviewed on every PR, and kept up to date by Dependabot.
- CodeQL scans the code and the workflows on every PR, on `main`, and weekly.
- Never commit secrets. `.env` files are git-ignored; if one ever leaks, rotate it immediately.
