# FlowBoard — Manager / HR Overview

## What is it?

FlowBoard is a realtime kanban board — a web app that lets a small team
visualize and move work cards (To Do / In Progress / Done) on a shared board.
When one person moves a card, everyone looking at the same board sees it
update instantly, with no page refresh. It is a complete, production-shaped
application built to demonstrate how a modern software team ships software
today.

## Why does it matter?

It is not a toy. FlowBoard was designed the way a real product would be:

- **It is reliable.** Concurrency is handled properly — if two people move
  cards at the same time, the board stays consistent. Every user only ever
  sees and edits their own boards (ownership checks).
- **It is secure.** Passwords are hashed, sessions use industry-standard JWTs,
  and the code went through an automated code review and a dedicated security
  audit. Findings from that audit were fixed (weak secrets, data leaks across
  boards, rate-limit bypasses) and verified again.
- **It is tested.** 24 backend tests, 7 frontend tests, plus an end-to-end
  check that drives the whole running app through its real-time flow.
- **It is deployable.** One command runs the entire stack in Docker. It also
  ships Kubernetes manifests (the standard way companies deploy cloud apps),
  a CI pipeline that checks every code change, and graceful shutdown so
  upgrades don't drop users.
- **It is maintainable.** Code is organized in clean layers (business rules
  separate from the database and the web layer), so a new developer can pick
  it up and teams can extend it without breaking things.

## Who would use it?

- Small teams that plan sprints, track tasks, or run support tickets.
- Startups and internal tools teams that need a simple, self-hosted kanban.
- Engineering orgs evaluating candidates' ability to build a real full-stack
  product — the codebase doubles as a portfolio project.

## The tech at a glance

| Area            | Choice                                |
|-----------------|---------------------------------------|
| Backend         | Node.js + TypeScript, Express         |
| Database        | PostgreSQL (via Prisma ORM)           |
| Realtime        | Redis pub/sub + WebSockets            |
| Frontend        | React 19 + Vite                       |
| Auth            | JWT (hashed passwords, rate limiting) |
| Infrastructure  | Docker Compose, Kubernetes, nginx     |
| Quality         | Jest, Vitest, GitHub Actions CI, npm audit |

## What has been delivered

- A working realtime kanban board, verified end-to-end (the smoke test passed
  against the running Docker stack).
- Automated code review + security audit, with every critical and medium
  finding fixed and re-verified.
- Tests, CI, Docker/Kubernetes deployments, and documentation
  ([README](../README.md), [technical](technical.md)).
