# TRON Payments

Internal tool for remote **2-of-3 multisig USDT TRC-20 payments** from a corporate TRON treasury address using Ledger hardware wallets.

## Quick Start

Requires [devbox](https://www.jetify.com/devbox) and Docker.

```bash
# Enter dev environment
devbox shell

# Install dependencies
devbox run install

# Copy and configure environment
cp .env.example .env
# Edit .env with treasury address, signers, TRON RPC URL

# Start PostgreSQL
devbox run docker:up

# Run database migrations (once API is implemented)
devbox run db:migrate

# Start all dev servers
devbox run dev
```

| Service | URL |
|---|---|
| Web UI | http://localhost:5173 |
| API | http://localhost:3000 |
| Signer client | http://localhost:3847 |

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
