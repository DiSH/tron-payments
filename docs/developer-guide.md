# Developer Guide

> **Status:** placeholder — to be expanded as implementation progresses.

## Prerequisites

- [devbox](https://www.jetify.com/devbox)
- Docker (Compose for Postgres, API, and Web)
- Node 22 (provided by devbox)

## Setup

```bash
devbox shell
devbox run install
cp .env.example .env
devbox run docker:up          # Postgres + API + Web; API runs migrations
devbox run seed:users         # optional dev users (from host, DATABASE_URL=localhost)
devbox run dev:signer         # Ledger client on the host — not in Docker
```

`devbox run dev` is the same stack as `docker:up`, but attached (logs in the foreground).

Host fallbacks if you are not using the API/Web containers: `devbox run dev:api` and `devbox run dev:web` (start Postgres with `docker compose up -d postgres` first).

## Docker

| File | Purpose |
|---|---|
| [`docker-compose.yml`](../docker-compose.yml) | Local: Postgres + API (`tsx watch`) + Web (Vite), bind-mounted source |
| [`docker-compose.prod.yml`](../docker-compose.prod.yml) | Production: API + nginx (SPA + TLS reverse proxy on `https://fboardpagec.com`). **No Postgres** — use `DATABASE_URL` |
| [`apps/api/Dockerfile`](../apps/api/Dockerfile) | Targets `development` / `production` |
| [`apps/web/Dockerfile`](../apps/web/Dockerfile) | Targets `development` / `production` (nginx) |

Local Compose overrides `DATABASE_URL` to host `postgres`. `POSTGRES_*` in `.env` only creates the local database container.

After changing npm dependencies, rebuild images and drop the node_modules volumes (Postgres data volume is separate):

```bash
docker compose build api web
docker volume rm tron-payments_api_node_modules tron-payments_web_node_modules
docker compose up -d
```

Production migrate + start: see [README](../README.md#production). First-time TLS: set `CERTBOT_EMAIL` and run `bash scripts/init-letsencrypt.sh` (or `devbox run docker:prod:cert`). nginx terminates HTTPS for `fboardpagec.com` and reverse-proxies `/api` and `/health`; the SPA is built with `VITE_API_BASE_URL=https://fboardpagec.com`. Compose sets `CORS_ORIGIN=https://fboardpagec.com`. Local signer against production: `API_BASE_URL=https://fboardpagec.com`.

The signer client is never containerized (Ledger USB/HID).

## Monorepo

| Workspace | Path | Purpose |
|---|---|---|
| `@tron-payments/api` | `apps/api` | Fastify backend |
| `@tron-payments/web` | `apps/web` | React frontend |
| `@tron-payments/signer` | `apps/signer` | Local Ledger client |
| `@tron-payments/shared` | `packages/shared` | Shared types and utilities |

## Development Order

1. Ledger POC on testnet (mandatory gate)
2. `packages/shared` — canonical hash, state machine, TRON helpers
3. `apps/api` — full backend
4. `apps/signer` — Ledger integration
5. `apps/web` — UI

See [AGENTS.md](../AGENTS.md) for agent instructions and [project bible](../.kiro/steering/project-bible.md) for full requirements.
