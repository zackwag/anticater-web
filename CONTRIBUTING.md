# Contributing to anticater-web

Thanks for your interest in improving this unofficial WebHID configurator for the ANTICATER VK-01 dial/macro-pad.

## Getting started

```sh
git clone https://github.com/zackwag/anticater-web.git
cd anticater-web
python3 -m http.server 8743
```

WebHID requires a secure context, so serve the app rather than opening `index.html` directly — see the README for details. Chrome, Edge, or Opera required (WebHID is Chromium-only).

## Development

This is a plain HTML/CSS/JS app, no build step or framework. Key files:

- `index.html`, `style.css`, `app.js` — the UI
- `protocol.js` — the reverse-engineered ANTICATER VK-01 wire protocol
- `version.js` — version display

Run the tests:

```sh
npm test
```

(runs `node --test` against `test/protocol.test.js`)

Run the linter:

```sh
npm install
npm run lint
```

(runs ESLint over `app.js`, `protocol.js`, `version.js`, and the test suite)

A `Dockerfile` (nginx-based) is provided as an alternative way to serve the app; see the README for `docker run` usage.

## Commit messages and pull requests

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, etc.). Pull requests are squash-merged, and the **PR title** becomes the commit on `main` — so PR titles must follow this format. This is enforced automatically by the "Conventional Commits" check.

Direct pushes to `main` are allowed but must also use a Conventional Commits-formatted commit message (validated by the same check).

## Opening a pull request

1. Fork the repo and create a branch off `main`.
2. Make your changes.
3. Open a pull request with a Conventional Commits-formatted title.
4. Wait for CI to pass — required checks must be green before merge.

## Reporting issues

Use [GitHub Issues](../../issues) for bugs and feature requests.
