# AGENTS.md

## TRON Payments — Agent Instructions

Internal tool for remote **2-of-3 multisig USDT TRC-20 payments** from a corporate TRON treasury using Ledger hardware wallets.

## Architecture (C4)

| Container | Role |
|---|---|
| Web SPA (`apps/web`) | React + Vite; dashboard, payment requests, WebHID Ledger connect/sign/login, audit |
| API (`apps/api`) | Fastify; auth (password + Ledger challenge), RBAC, tx builder, signature verifier, broadcast |
| PostgreSQL | Payment requests, signatures, audit events, job queue |
| Shared (`packages/shared`) | Types, canonical hash, state machine, TRON helpers |

**Critical:** Private keys never leave the Ledger. The SPA uses WebHID (`@ledgerhq/hw-transport-webhid` + `@ledgerhq/hw-app-trx`) on user gesture. Backend verifies ECDSA signatures and never accesses Ledger hardware.

**Canonical docs:**

- [`.kiro/steering/project-bible.md`](.kiro/steering/project-bible.md) — SSOT for product rules, security invariants, domain model
- [`docs/architecture.md`](docs/architecture.md) — full C1–C4 architecture
- Cursor rules: `.cursor/rules/tron-payments-core.mdc`, `.cursor/rules/architecture-c4.mdc`

**Architecture changes:** if a task would add a container, change the signing model, introduce private key handling, or break a security invariant — **ask the user for approval first**, then update `docs/architecture.md` and the bible in the same change set.

### Standard commands

**Local environment:** Devbox + Docker Compose (Postgres, API, Web). All commands run inside devbox unless noted.

```bash
devbox shell              # enter dev environment
devbox run install        # npm install (all workspaces)
cp .env.example .env      # fill in RPC / auth secrets
devbox run docker:up      # Postgres + API + Web (hot reload)
devbox run test           # run all workspace tests
devbox run validate:config # validate DB treasury config against TRON RPC (exit 0 if not configured)
```

Runtime: Node 22 + npm (canonical package manager; `packageManager` is `npm@10.9.4`).

| Command | Description |
|---|---|
| `devbox run dev` | Foreground `docker compose up` (Postgres + API + Web) |
| `devbox run dev:api` | API on the host (port 3000) — fallback without containers |
| `devbox run dev:web` | Web on the host (port 5173) — fallback without containers |
| `devbox run db:migrate` | Run Drizzle migrations against `DATABASE_URL` (host) |
| `devbox run lint` | Lint all workspaces |
| `devbox run build` | Build all workspaces |
| `devbox run docker:down` | Stop local Compose stack |
| `devbox run docker:prod:migrate` | Run migrations in the production API image |
| `devbox run docker:prod:cert` | Issue Let's Encrypt cert for `fboardpagec.com` (`bash scripts/init-letsencrypt.sh`) |
| `devbox run docker:prod:up` | Build and start production Compose (API + nginx TLS, no Postgres) |

Copy `.env.example` to `.env` and fill in RPC / DB / auth. Local Compose overrides `DATABASE_URL` to the `postgres` service. Production Compose has no database — point `DATABASE_URL` at your Postgres. Production nginx serves `https://fboardpagec.com` (set `CERTBOT_EMAIL`, then `devbox run docker:prod:cert`). Configure treasury address and signers via Admin → Treasury Settings after first login. Ledger login can create accounts; Admin assigns the `signer` role and treasury allowlist.

### Security rules (non-negotiable)

1. **Never** ask for or store seed phrases, private keys, PINs, or Ledger secrets.
2. **Never** use `tronWeb.trx.multiSign(..., privateKey, ...)` in production paths.
3. **Never** give the backend access to Ledger hardware.
4. WebHID Ledger access is allowed in the SPA only on user gesture; do not log APDU/secrets; always close the transport.
5. **Never** use `float` or JavaScript `number` for USDT amounts — use `bigint` or decimal strings.
6. **Never** accept arbitrary raw transactions or smart contract calldata from UI.
7. **Never** broadcast without server-side signature verification and on-chain weight ≥ 2.
8. **Never** move mainnet funds before testnet POC and acceptance tests pass.

### Development order (MVP)

1. **Ledger POC on testnet** — mandatory gate before full MVP (see bible §11.2)
2. `packages/shared` — types, canonical hash, state machine, TRON helpers
3. `apps/api` — config validation, payment request CRUD, tx builder, signature verifier
4. `apps/web` — UI pages + WebHID Ledger module
5. Integration tests + testnet acceptance suite
6. Mainnet rollout with minimum amount limit

### Testing

- Unit tests: Vitest in each workspace
- Integration tests: API against testnet RPC (or mocked)
- Hardware POC: documented in `docs/ledger-poc-report.md`
- Acceptance matrix: `docs/testnet-acceptance-report.md`

Run: `devbox run test`

### Scope rules

- Minimal diff — no drive-by refactors
- Append-only DB migrations — never edit existing migration files
- Every mutating API endpoint creates an AuditEvent
- Shared logic goes in `packages/shared`, not duplicated across apps
- Update docs when behavior or architecture changes

### Placeholder docs (to be completed during MVP)

| Document | Purpose |
|---|---|
| `docs/threat-model.md` | Threat analysis |
| `docs/developer-guide.md` | Developer onboarding |
| `docs/admin-runbook.md` | Deployment and operations |
| `docs/finance-operator-guide.md` | End-user guide for finance team |
| `docs/known-limitations.md` | MVP limitations |
| `docs/testnet-acceptance-report.md` | Acceptance test results |
| `docs/ledger-poc-report.md` | Ledger integration POC results |
