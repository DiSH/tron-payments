# TRON Payments

Internal tool for remote **multisig USDT TRC-20 payments** from a corporate TRON treasury address using Ledger hardware wallets.

## Quick Start

Requires [devbox](https://www.jetify.com/devbox) and Docker.

```bash
# Enter dev environment
devbox shell

# Install dependencies
devbox run install

# Copy and configure environment
cp .env.example .env
# Edit .env with TRON RPC URL and auth secrets

# Start Postgres + API + Web (hot reload). Migrations run on API start.
devbox run docker:up
# or foreground: devbox run dev
```

Ledger signing uses **WebHID in the browser** (Chrome/Edge over HTTPS or localhost). Plug in your Ledger, open the Tron app, then use Connect Ledger / Sign in with Ledger / Sign with Ledger in the UI.

| Service | URL |
|---|---|
| Web UI | http://localhost:5173 |
| API | http://localhost:3000 |

## Production

PostgreSQL is **not** in the production Compose file. Point `DATABASE_URL` (and other secrets) at `.env`. The SPA is served from `https://fboardpagec.com`; nginx reverse-proxies `/api` and `/health` so the browser uses the same origin (required for WebHID secure context).

1. DNS A record for `fboardpagec.com` → this host; ports 80 and 443 open.
2. Set `CERTBOT_EMAIL` in `.env`. Production Compose sets `CORS_ORIGIN=https://fboardpagec.com` and bakes `VITE_API_BASE_URL=https://fboardpagec.com`.
3. Issue TLS, migrate, then start:

```bash
bash scripts/init-letsencrypt.sh
docker compose -f docker-compose.prod.yml run --rm api npm run db:migrate
docker compose -f docker-compose.prod.yml up -d --build
```

Or: `devbox run docker:prod:cert`, then `devbox run docker:prod:migrate`, then `devbox run docker:prod:up`.

## Project Structure

```text
apps/
  api/       Fastify backend
  web/       React frontend + WebHID Ledger module
packages/
  shared/    Shared types, canonical hash, TRON helpers
docs/        Architecture, runbooks, threat model
.kiro/       Project bible (SSOT)
.cursor/     Agent rules
```

## Documentation

| Document | Description |
|---|---|
| [Project Bible](.kiro/steering/project-bible.md) | Authoritative product and security reference |
| [Architecture (C4)](docs/architecture.md) | System architecture |
| [AGENTS.md](AGENTS.md) | Instructions for coding agents |

## Security

- Private keys and seed phrases **never** enter this system
- Ledger signing happens in the Web SPA via WebHID; the backend never accesses Ledger hardware
- Backend verifies signatures cryptographically and checks on-chain weight before broadcast
- MVP supports only USDT TRC-20 `transfer(address,uint256)` on TRON mainnet
- App role `signer` is distinct from on-chain multisig keys; Admin assigns both role and treasury allowlist

## License

Private — internal use only.
