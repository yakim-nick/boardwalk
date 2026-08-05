# FlowBoard — Technical Documentation

## Overview

FlowBoard is a realtime kanban board. The backend is a layered TypeScript
service (domain / application / infrastructure / api) that follows SOLID
principles. The frontend is a React 19 SPA that talks to the backend over a
REST API and a WebSocket connection. When one user changes a board, every
other user viewing that board sees the change instantly.

```
Browser ── HTTP ────────────► nginx ──► Express API (REST)
   └────── WS (subprotocol) ──► nginx ──► ws server (realtime hub)
```

## Backend architecture

The code is split into four layers. Dependencies point inward only
(api → application → domain; infrastructure implements domain ports).

| Layer            | Location              | Responsibility                                    |
|------------------|-----------------------|----------------------------------------------------|
| Domain           | `src/domain`          | Entities, repository **ports** (interfaces), service interfaces, error types, realtime event contract |
| Application      | `src/application`     | Use cases (`AuthServiceImpl`, `BoardServiceImpl`): validation, ownership checks, orchestration |
| Infrastructure   | `src/infrastructure`  | Prisma repositories, Redis (pub/sub + store), the WebSocket hub |
| API / composition| `src/api`, `src/server.ts` | HTTP controllers, middleware (auth, validation, rate limits, errors), routes, dependency wiring |

This layering means the HTTP/WebSocket concerns never leak into business logic,
and the business logic never depends on Prisma or Redis directly.

### Domain

- `entities.ts` — `User`, `Board`, `Column`, `Task`, `BoardWithDetails`.
- `repositories.ts` — `UserRepository`, `BoardRepository` interfaces (what the
  application layer needs, not how it is done).
- `services/` — `AuthService`, `BoardService`, and `RealtimeEventPublisher`
  (the port used to emit `task.created` / `task.updated` / `task.deleted`
  events), plus the `RealtimeEvent` shape.
- `errors.ts` — typed domain errors (`NotFoundError`, `ForbiddenError`,
  `ConflictError`, `UnauthorizedError`, …) mapped to HTTP statuses centrally.

### Application

`BoardServiceImpl` enforces every business rule:

- A board belongs to an owner; all reads/writes check ownership.
- Tasks must reference columns that belong to the same board.
- Task ordering is maintained transactionally: when a task is created, moved,
  updated, or deleted, `normalizeColumnOrders` re-indexes the affected column
  so orders stay gap-free — even under concurrent writes (interactive Prisma
  transaction).

### Infrastructure

- `repositories/prisma.repositories.ts` — Prisma implementations. Notable
  methods: `runInTransaction(work)` wraps work in an interactive transaction;
  `maxTaskOrder`, `normalizeColumnOrders` support gap-free ordering.
- `redis/redis.ts` — ioredis client + subscriber, with optional `REDIS_PASSWORD`.
- `websocket/realtime.ts` — `RealtimeHub`, the realtime fan-out engine
  (see below).

### Realtime engine (RealtimeHub)

Security model:

1. A client authenticates at the WebSocket handshake by sending
   `["flowboard", <JWT>]` as the subprotocol. The server verifies the token
   before accepting; invalid tokens are closed with code `4401`.
2. A client must explicitly send `{ type: "subscribe", boardId }`. The hub
   verifies the caller **owns** the board via `BoardService.getBoard` before
   registering the subscription.
3. Events are delivered **only** to sockets subscribed to the event's board —
   never broadcast to unrelated clients.

Scalability model:

- Mutations publish a `RealtimeEvent` to a shared Redis channel
  (`flowboard:events`). Every backend instance relays events it receives only
  to its own local, subscribed sockets. This keeps events correct when the
  backend scales horizontally (the Kubernetes manifests include an HPA).

Operational guards:

- Connection caps: max 500 total clients, max 8 sockets per user.
- Heartbeat every 30s (ping/pong); dead sockets are terminated.
- `maxPayload` of 16 KB on the WebSocket server.

### API surface

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- `POST /api/v1/boards`, `GET /api/v1/boards`, `GET /api/v1/boards/:id`
- `POST /api/v1/boards/:id/columns`
- `POST /api/v1/boards/:boardId/tasks`, `PATCH /api/v1/boards/:boardId/tasks/:taskId`, `DELETE /api/v1/boards/:boardId/tasks/:taskId`
- `GET /api/v1/health`

Security middleware: JWT verification with pinned algorithm/issuer/audience,
Zod request validation, Redis-backed rate limiting (auth: 20/15min; API:
120/min), Helmet security headers, CORS allow-list, centralized error mapping.

## Frontend architecture

- `src/api/client.ts` — typed REST client; stores the JWT in `localStorage`.
- `src/api/socket.ts` — WebSocket client: connects with the subprotocol,
  sends `subscribe` on open, emits `reconnected` when the socket drops and
  reconnects so the page can refetch state.
- `src/pages/Board.tsx` — loads the board, applies realtime events to local
  state with immutable updates, uses functional `setState` to stay consistent,
  and re-fetches after a failed action or a socket reconnection.
- `src/components/` — `BoardColumn`, `TaskCard`, `AddTaskModal`.
- Drag & drop computes the target position from the cursor's position in the
  target column (`getBoundingClientRect`) and sends the new order to the API.
- Styling: a single external stylesheet `src/styles/styles.css`.

## Security hardening

A dedicated security audit was performed; key results and fixes:

- **Cross-board WS leaks** → per-board server-side subscriptions with an
  ownership check on `subscribe`; events fan out only to subscribers of that
  board.
- **Weak default JWT secrets** → the backend fails fast in production if
  `JWT_SECRET` is missing, shorter than 32 chars, or a known default; Docker
  Compose now requires `JWT_SECRET` from the environment instead of defaulting.
- **`prisma` CLI only in devDependencies** → moved to `dependencies` so the
  runtime image can run `migrate deploy` and generate the client without
  fetching from the registry.
- **Rate-limit spoofing via X-Forwarded-For** → nginx overwrites
  `X-Forwarded-For` with `$remote_addr`, and the backend is no longer published
  on a host port in Docker.
- **WS hardening** → token in subprotocol (not URL), origin allow-list,
  payload/connection caps, heartbeat.
- **Frontend** → CSP and other headers set at nginx, no-cache on `index.html`.
- **Kubernetes** → secrets in a Secret object, `runAsNonRoot`, dropped
  capabilities, read-only root FS (with emptyDir for temp), resource limits,
  readiness/liveness probes, TLS ingress annotations.

## Testing

- Backend: Jest + Supertest against a real Postgres (`flowboard_test` on host
  port 5433) and Redis (port 6380). Run serially with `--runInBand` because the
  suites share one database. Rate limiters are no-ops when `NODE_ENV=test`.
- Frontend: Vitest + Testing Library (task card, add-task modal).
- E2E: `backend/smoke-test.js` exercises the full running stack through nginx —
  register, login, create board, create task, receive the realtime WS event,
  move, delete, verify — including WebSocket subprotocol auth.

## Operations

- `docker-compose.yml` — full stack; Postgres (5433→5432), Redis (6380→6379),
  backend (not published), frontend nginx (8080→80). Migrations run on startup
  (`prisma migrate deploy`).
- `infra/k8s/` — deployable via `kubectl apply -k infra/k8s` after filling in
  `secret.yaml` and the ingress host.
- `.github/workflows/ci.yml` — npm ci, `npm audit`, typecheck, tests, builds,
  and Docker image builds.
- Graceful shutdown: SIGTERM stops accepting connections, terminates WS
  clients, and disconnects Redis/Prisma before exiting.
