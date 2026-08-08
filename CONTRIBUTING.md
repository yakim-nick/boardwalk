# Contributing to FlowBoard

Thanks for your interest in contributing! This project is a production-shaped
reference, so the bar is: changes should be as clean and well-tested as the
existing code.

## Getting started

```sh
make install      # backend + frontend deps
make db-up        # Postgres (5433) + Redis (6380)
make migrate      # apply Prisma migrations
make dev-backend  # http://localhost:4000
make dev-frontend # http://localhost:5173
```

## Before you open a PR

- Run `npm run typecheck` and `npm test` in `backend/` (tests must run
  serially — the npm script already uses `--runInBand`).
- Run `npm run typecheck`, `npm test`, and `npm run build` in `frontend/`.
- Keep the architecture: domain/application/infrastructure layers on the
  backend; no Prisma/Redis/HTTP details leaking into business logic.
- If you change the realtime layer, preserve the security model: WebSocket
  auth via subprotocol, per-board subscriptions with an ownership check, and
  fan-out only to subscribers of the board.
- Add or update tests. For API changes, extend the backend Jest suites or
  `backend/smoke-test.js`.

## Commits

Follow the conventional-commits style, e.g. `feat(boards): ...`,
`fix(tasks): ...`, `docs(security): ...`.

## Reaching out

Open an issue for discussions, bugs, or feature ideas before large changes.
