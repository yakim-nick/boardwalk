# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you believe you have found a security vulnerability:

- **Do not** open a public issue describing it.
- Report it privately by email or through GitHub's Security Advisories
  ("Report a vulnerability") flow on this repository.
- Include a description of the issue, how to reproduce it, and the affected
  version.

You will receive a response within 5 business days, and we will coordinate a
fix before disclosing details publicly.

## Deployment checklist

- Set a strong `JWT_SECRET` (`openssl rand -hex 64`). The backend refuses to
  start in production with a missing, short, or default secret.
- Set a strong `REDIS_PASSWORD`.
- Do not expose the backend, PostgreSQL, or Redis on host ports in production
  (the Docker Compose setup already keeps them internal behind nginx).
- Replace the placeholder values in `infra/k8s/secret.yaml` before deploying
  to a cluster.
- If you modify the WebSocket layer, keep the per-board subscription model
  (events must only reach clients that own the board).
