# TRON Payments

Internal tool for remote **2-of-3 multisig USDT TRC-20 payments** from a corporate TRON treasury address using Ledger hardware wallets.

## Quick Start

Requires [devbox](https://www.jetify.com/devbox) and Docker.

```bash
# Enter dev environment
devbox shell

# Install dependencies (host; also used by tests / signer)
devbox run install

# Copy and configure environment
cp .env.example .env
# Edit .env with TRON RPC URL and auth secrets

# Start Postgres + API + Web (hot reload). Migrations run on API start.
devbox run docker:up
# or foreground: devbox run dev
```

Signer stays on the host (Ledger USB): `devbox run dev:signer`.

| Service | URL |
|---|---|
| Web UI | http://localhost:5173 |
| API | http://localhost:3000 |
| Signer client | http://localhost:3847 |

## Production

PostgreSQL is **not** in the production Compose file. Set `DATABASE_URL` (and other secrets) in `.env`, bake the browser API URL into the SPA, migrate, then start:

```bash
# VITE_API_BASE_URL is the URL the browser uses to reach the API
export VITE_API_BASE_URL=https://api.example.com
docker compose -f docker-compose.prod.yml run --rm api npm run db:migrate
docker compose -f docker-compose.prod.yml up -d --build
```

Or: `devbox run docker:prod:migrate` then `devbox run docker:prod:up`.

## Project Structure

```text
apps/
  api/       Fastify backend
  web/       React frontend
  signer/    Local Ledger signing client
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
- Ledger signing happens **only** in the local signer client (`apps/signer`)
- Backend verifies signatures cryptographically and checks on-chain weight before broadcast
- MVP supports only USDT TRC-20 `transfer(address,uint256)` on TRON mainnet

## Development Status

Repository initialized with project bible, agent rules, devbox environment, and monorepo skeleton. Implementation follows the order in [AGENTS.md](AGENTS.md): Ledger POC → shared → API → signer → web.

## License

Private — internal use only.
