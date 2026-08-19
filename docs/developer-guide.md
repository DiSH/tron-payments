# Developer Guide

> **Status:** placeholder — to be expanded as implementation progresses.

## Prerequisites

- [devbox](https://www.jetify.com/devbox)
- Docker (for PostgreSQL)
- Node 22 (provided by devbox)

## Setup

```bash
devbox shell
devbox run install
cp .env.example .env
devbox run docker:up
devbox run dev
```

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
