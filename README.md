# FlowBoard

A realtime, collaborative kanban board for small teams. Built as a full-stack
reference project: TypeScript end-to-end, layered (SOLID) backend architecture,
server-side event fan-out over WebSockets, hardened with an agent code review
and a security audit, and shipped as a Docker Compose stack with optional
Kubernetes manifests and a CI pipeline.

- **Backend** — Node.js 22, Express, TypeScript, Prisma + PostgreSQL, Redis
  (pub/sub + rate limiting), `ws` for WebSockets, JWT auth, Zod validation,
  pino logging. 24 tests (Jest + Supertest).
- **Frontend** — React 19, Vite, react-router 8, Vitest + Testing Library
  (7 tests). Styling lives in a single external CSS file.
- **Infra** — Docker Compose (full stack behind nginx), Kubernetes manifests
  (Kustomize), GitHub Actions CI, Makefile.

## What it does

- Create an account and log in (JWT-based sessions).
- Create boards with three default columns (To Do / In Progress / Done).
- Add, edit, drag-and-drop, and delete cards; changes are visible to every
  connected user in real time via WebSockets.
- Column ordering stays consistent even with concurrent edits (transactional
  order normalization).
- The app enforces ownership: you can only see, edit, and move your own boards.

## Quick start (Docker)

```sh
cp .env.example .env
# In .env set real secrets:
#   JWT_SECRET=$(openssl rand -hex 64)
#   REDIS_PASSWORD=$(openssl rand -hex 24)
make docker-up          # or: docker compose up --build
```

Open http://localhost:8080 — the frontend (nginx) serves the app and proxies
`/api` and `/ws` to the backend. The backend, PostgreSQL (host port 5433), and
Redis (host port 6380) are **not** exposed to the host in the Docker stack.

> The backend runs as `NODE_ENV=production` and **refuses to start** with a
> weak or default `JWT_SECRET`.

## Quick start (local dev)

```sh
make db-up              # Postgres (5433) + Redis (6380)
make install
make migrate
make dev-backend        # http://localhost:4000
make dev-frontend       # http://localhost:5173
```

## Tests, lint, build

```sh
make test               # backend (Jest, --runInBand) + frontend (Vitest)
make build
```

## Project layout

```
backend/    Express API, domain/application/infrastructure layers, Prisma schema & migrations, tests
frontend/   React SPA, API client, WebSocket client, components, styles
infra/k8s/  Kubernetes manifests (Kustomize)
.github/    GitHub Actions CI
scripts/    helper scripts
```

## Deployment

- **Docker:** `make docker-up` (see above).
- **Kubernetes:** replace the placeholder values in `infra/k8s/secret.yaml`,
  set the real host in `infra/k8s/ingress.yaml`, then `make k8s-apply`.
- **CI:** `.github/workflows/ci.yml` typechecks, audits, tests, and builds both
  apps and the Docker images.

See [docs/technical.md](docs/technical.md) for architecture details and
[docs/manager-hr-overview.md](docs/manager-hr-overview.md) for a non-technical
summary.
