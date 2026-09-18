# AGENTS.md

## Project overview

Unofficial browser-based WebHID configurator for the ANTICATER VK-01 dial/macro-pad, replacing the bundled (Rosetta-requiring) native app. Plain HTML/CSS/JS, no framework or build step. Chromium-only (WebHID API).

## Setup

No install step to run the app — plain static files. Run `npm install` if you need to lint (ESLint is a devDependency).

## Build / Run

```sh
python3 -m http.server 8743
```

Then open `http://localhost:8743/` in Chrome/Edge/Opera. WebHID requires a secure context (localhost counts), so don't open `index.html` as a `file://` URL.

Alternative: `docker run -p 127.0.0.1:8743:80 zackwag/anticater-web` (built from the repo's `Dockerfile`, an nginx static server).

## Test

```sh
node --test
```

(also runnable as `npm test`). Tests live in `test/protocol.test.js` and cover `protocol.js`, the reverse-engineered wire format.

Lint with `npm run lint` (ESLint, flat config in `eslint.config.js`). CI runs both `test` and `lint` as separate required jobs.

## Repository structure

- `index.html`, `style.css`, `app.js` — the UI and app logic
- `protocol.js` — documented ANTICATER VK-01 wire protocol (write side reverse-engineered via `libhidapi` interception; read side from x0rloser/anticater_vk01)
- `version.js` — version constant shown in the UI
- `test/protocol.test.js` — protocol tests
- `Dockerfile` — nginx-based static server for `docker run` usage

## Commit and PR conventions

- Commit messages and PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`, `build:`, `perf:`, `style:`, `revert:`), optionally with a scope, e.g. `fix(api): handle null response`.
- This repo squash-merges pull requests only; the PR title becomes the final commit message on `main`.
- A "Conventional Commits" CI check enforces this on both PR titles and direct-push commit messages.
- Branch protection on `main`: no force-pushes, no branch deletion, required status checks must pass.
