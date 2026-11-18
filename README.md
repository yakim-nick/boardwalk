# FlowBoard

[![CI](https://github.com/yakim-nick/flowboard-app/actions/workflows/ci.yml/badge.svg)](https://github.com/yakim-nick/flowboard-app/actions/workflows/ci.yml)

A realtime kanban board: create boards, move cards between columns, and see
changes appear instantly in every open tab or device of the board's owner.
Built as a full-stack TypeScript project to practise a layered backend,
WebSocket fan-out through Redis, and a Docker/Kubernetes deployment.

<!-- TODO(screenshot): add a screenshot or GIF of the board here.
     How: run the Docker stack (see Quick start), register, create a board, add
     a few cards, then record with a screen recorder (e.g. peek / OBS) or take a
     screenshot. Save it as docs/img/board.png (or .gif) and embed it with
     ![FlowBoard board](docs/img/board.png) -->

## Features

- Register and log in (JWT access token).
- Create boards; every board starts with three columns: **Backlog**, **In
  Progress**, **Done**. Add extra columns.
- Add, edit, move (drag and drop) and delete cards.
- Realtime: card changes are pushed over WebSockets to every session of the
  board's **owner** (several tabs/devices stay in sync). Events travel through
  Redis pub/sub, so they also reach sessions connected to another backend
  instance.
- Card order inside a column is kept gap-free with transactional re-indexing.
- Ownership is enforced: you can only read or change your own boards.

## Tech stack

| Part | Stack |
|------|-------|
| Backend | Node.js 22 (Docker/CI), Express, TypeScript (strict), Prisma + PostgreSQL 16, Redis 7 (pub/sub + rate-limit store), `ws`, JWT, Zod, pino, helmet |
| Frontend | React 19, Vite, react-router, Vitest + Testing Library (Node 22 in Docker/CI) |
| Infra | Docker Compose (nginx in front), Kubernetes manifests (Kustomize), GitHub Actions, Makefile |

## Quick start (Docker, about 5 minutes)

Requires Docker with Compose and `openssl`.

```sh
cp .env.example .env
# Generate real secrets (the backend refuses weak ones in production mode):
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 64)/" .env
sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$(openssl rand -hex 24)/" .env
# The app is served on port 8080; the WebSocket origin check must allow it:
sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=http://localhost:8080|" .env
docker compose up --build
```

Open http://localhost:8080. nginx serves the frontend and proxies `/api` and
`/ws` to the backend. The backend itself is not published on a host port.
For convenience, Postgres is published on host port 5433 and Redis on 6380
(see [Known limitations](#known-limitations)).

> Without the `CORS_ORIGIN` line the REST API works, but realtime updates are
> rejected with `Origin not allowed`.

## Local development

```sh
cp .env.example .env                 # defaults are fine for development
make db-up                           # Postgres (5433) + Redis (6380)
make install
```

The backend does not read `.env` by itself, so export it first (once per shell):

```sh
set -a; . ./.env; set +a
make migrate
make dev-backend                     # http://localhost:4000
make dev-frontend                    # http://localhost:5173 (separate shell)
```

## Tests

Backend tests use a real PostgreSQL and Redis (no mocks), so start them first
and create the test database once:

```sh
make db-up
docker compose exec postgres createdb -U flowboard flowboard_test
make test                            # backend (Jest, --runInBand) + frontend (Vitest)
make coverage                        # backend tests with a coverage report
make lint                            # ESLint + Prettier check, backend and frontend
```

Last verified locally: backend 24 tests passing (about 69% statement coverage;
the WebSocket hub is only about 11% covered), frontend 7 tests passing.
CI runs, for backend and frontend: `npm audit` on production dependencies,
typecheck, ESLint (`no-explicit-any` is an error), a Prettier check, tests and
builds, plus the Docker image builds. The backend run enforces a coverage floor
(65% statements, 45% branches; a regression guard, not a quality claim) and
uploads the report as an artifact. There is no frontend coverage yet.

## Project layout

```
backend/    Express API: domain / application / infrastructure / api layers,
            Prisma schema and migrations, tests
frontend/   React SPA, API client, WebSocket client
infra/k8s/  Kubernetes manifests (Kustomize)
docs/       technical.md (architecture notes)
.github/    GitHub Actions CI
```

## Design decisions

- **Layered backend with ports.** Business rules live in services that depend
  on interfaces (`domain/repositories`); Prisma and Redis are implementations.
  Wiring happens in one composition root (`backend/src/server.ts`).
- **Redis pub/sub for realtime.** Every mutation publishes an event; each
  backend instance relays it to its own subscribed sockets, so the design still
  works with more than one instance.
- **Per-board subscriptions.** A socket must `subscribe` to a board and the
  server checks ownership before accepting it.
- **Zod at the edge.** Request bodies and params are validated before they
  reach services; errors share one `{ error: { code, message } }` shape.
- **JWT pinned** to HS256 with issuer and audience; the server refuses to start
  in production with a short or placeholder secret.

More detail: [docs/technical.md](docs/technical.md).

## Known limitations

- **Boards are single-owner.** There is no sharing or membership, so no
  multi-user collaboration yet; realtime updates reach only the owner's own
  sessions.
- The JWT is kept in `localStorage` (exposed to XSS) and there is no logout
  endpoint, refresh token or token revocation.
- Database migrations run at container start (`prisma migrate deploy`), which
  can race if several replicas start at once.
- The Docker stack publishes Postgres and Redis on host ports and uses a fixed
  Postgres password for local convenience. Do not use it as-is in production.
- Realtime and rate limiting have little or no automated test coverage.
- `backend/smoke-test.js` is not run in CI and can fail because it creates a
  card before the WebSocket subscription is confirmed.
- Kubernetes manifests have not been verified against a live cluster in this
  repository's CI.

## Roadmap

- Board sharing (members and roles) with realtime events for all members.
- Tests for the WebSocket hub and the rate limiter, and frontend coverage.
- Healthchecks in the Docker images and the smoke test in CI.
- Better auth handling (logout, refresh tokens).

## Deployment

- **Docker:** see Quick start.
- **Kubernetes:** replace the placeholder values in `infra/k8s/secret.yaml`,
  set the real host in `infra/k8s/ingress.yaml`, then `make k8s-apply`.

## License

MIT
