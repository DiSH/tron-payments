# AGENTS.md

## TRON Payments — Agent Instructions

Internal tool for remote **2-of-3 multisig USDT TRC-20 payments** from a corporate TRON treasury using Ledger hardware wallets.

## Architecture (C4)

| Container | Role |
|---|---|
| Web SPA (`apps/web`) | React + Vite; dashboard, payment requests, signing queue, audit |
| API (`apps/api`) | Fastify; auth, RBAC, tx builder, signature verifier, broadcast |
| Signer Client (`apps/signer`) | Local Ledger client via USB/HID — **never deployed to server** |
| PostgreSQL | Payment requests, signatures, audit events, job queue |
| Shared (`packages/shared`) | Types, canonical hash, state machine, TRON helpers |

**Critical:** Ledger interaction happens **only** in `apps/signer` on the signer's local machine. Backend and Web UI must never access Ledger hardware or private keys.

**Canonical docs:**

- [`.kiro/steering/project-bible.md`](.kiro/steering/project-bible.md) — SSOT for product rules, security invariants, domain model
- [`docs/architecture.md`](docs/architecture.md) — full C1–C4 architecture
- Cursor rules: `.cursor/rules/tron-payments-core.mdc`, `.cursor/rules/architecture-c4.mdc`

**Architecture changes:** if a task would add a container, change the signing model, introduce private key handling, or break a security invariant — **ask the user for approval first**, then update `docs/architecture.md` and the bible in the same change set.

### Standard commands

**Local environment:** Devbox + Docker Compose (PostgreSQL). All commands run inside devbox.

```bash
devbox shell              # enter dev environment
devbox run install        # npm install (all workspaces)
devbox run docker:up      # start PostgreSQL
devbox run dev            # start api + web + signer dev servers
devbox run test           # run all workspace tests
devbox run validate:config # validate DB treasury config against TRON RPC (exit 0 if not configured)
```

Runtime: Node 22 + npm (canonical package manager; `packageManager` is `npm@10.9.4`).

| Command | Description |
|---|---|
| `devbox run dev:api` | API only (port 3000) |
| `devbox run dev:web` | Web only (port 5173) |
| `devbox run dev:signer` | Signer client (port 3847) |
| `devbox run db:migrate` | Run Drizzle migrations |
| `devbox run lint` | Lint all workspaces |
| `devbox run build` | Build all workspaces |

Copy `.env.example` to `.env` and fill in RPC / DB / auth. Configure treasury address and signers via Admin → Treasury Settings after first login.

### Security rules (non-negotiable)

1. **Never** ask for or store seed phrases, private keys, PINs, or Ledger secrets.
2. **Never** use `tronWeb.trx.multiSign(..., privateKey, ...)` in production paths.
3. **Never** give backend or web UI access to Ledger hardware.
4. **Never** use `float` or JavaScript `number` for USDT amounts — use `bigint` or decimal strings.
5. **Never** accept arbitrary raw transactions or smart contract calldata from UI.
6. **Never** broadcast without server-side signature verification and on-chain weight ≥ 2.
7. **Never** move mainnet funds before testnet POC and acceptance tests pass.

### Development order (MVP)

1. **Ledger POC on testnet** — mandatory gate before full MVP (see bible §11.2)
2. `packages/shared` — types, canonical hash, state machine, TRON helpers
3. `apps/api` — config validation, payment request CRUD, tx builder, signature verifier
4. `apps/signer` — local Ledger signing client
5. `apps/web` — UI pages per bible §12
6. Integration tests + testnet acceptance suite
7. Mainnet rollout with minimum amount limit

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
