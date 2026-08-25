# TRON Payments — System Architecture (C4)

**Status:** living document  
**Owner:** Finance / Engineering  
**Last reviewed:** 2026-08-24

Canonical C4 architecture reference for the TRON multisig 2-of-3 USDT treasury MVP. AI agents and human contributors must read this before changing system boundaries, adding containers, or introducing new cross-cutting flows.

**Related docs:**

| Document | Role |
|---|---|
| [`.kiro/steering/project-bible.md`](../.kiro/steering/project-bible.md) | Product rules, security invariants, domain model |
| [`AGENTS.md`](../AGENTS.md) | Agent setup, devbox commands, quick reference |
| [`docs/threat-model.md`](./threat-model.md) | Threat analysis (to be completed) |

**Decision hierarchy:**

1. Production runtime and applied migrations
2. Security invariants (bible §2)
3. Project Bible
4. **This document**
5. Feature specs, source code

---

## C1 — System Context

Internal corporate tool for remote **2-of-3 multisig USDT TRC-20 payments** from a TRON treasury address. Three finance operators use Ledger hardware wallets to sign; a central backend coordinates requests, verifies signatures, and broadcasts.

### Actors

| Actor | Description |
|---|---|
| **Finance Requester** | Creates USDT payment requests |
| **Signer** | Reviews and signs with personal Ledger (WebHID) |
| **Executor** | Triggers broadcast after threshold (may overlap with signers) |
| **Admin** | User management, app configuration |
| **Auditor** | Read-only access to requests and audit trail |

### System Context Diagram

```mermaid
flowchart TB
  subgraph actors [Actors]
    Req[FinanceRequester]
    SA[Signer]
    Exec[Executor]
    Admin[Admin]
    Audit[Auditor]
  end

  SYS[TRONPayments_MVP]

  subgraph external [External Systems]
    TRON[TRON_Mainnet_RPC]
    Scan[TronScan_Explorer]
    OIDC[Corporate_OIDC_SSO]
    Ledger[Ledger_Hardware_Wallets]
    LE[LetsEncrypt]
  end

  Req --> SYS
  SA --> SYS
  Exec --> SYS
  Admin --> SYS
  Audit --> SYS

  SYS --> TRON
  SYS --> OIDC
  SYS --> LE
  SA --> Ledger
  TRON --> Scan
```

### External Systems

| System | Relationship | Notes |
|---|---|---|
| **TRON Mainnet RPC** | Read/write node access | Permissions, balances, sign weight, broadcast |
| **TronScan** | Read-only explorer links | Post-broadcast confirmation URLs |
| **Corporate OIDC** | Authentication (or email+password / Ledger login for MVP) | No seed-based auth |
| **Ledger devices** | Signing hardware | Accessed by Web SPA via WebHID (secure context) |
| **Let's Encrypt** | TLS certificates (production) | HTTP-01 via nginx webroot; certbot sidecar in production Compose |

---

## C2 — Containers

```mermaid
flowchart TB
  subgraph browser [User Browser]
    WEB[WebSPA_React_Vite_WebHID]
    LED[Ledger_USB]
  end

  subgraph server [Server — Docker Compose]
    NGINX[nginx_TLS]
    API[API_Fastify_TypeScript]
    PG[(PostgreSQL_16)]
    WORK[BroadcastWorker]
  end

  TRON[TRON_RPC]

  WEB -->|HTTPS_same_origin| NGINX
  WEB -->|WebHID| LED
  NGINX -->|"/api /health"| API
  API --> PG
  API --> TRON
  WORK --> PG
  WORK --> TRON
```

### Container Inventory

| Container | Technology | Responsibility |
|---|---|---|
| **Web SPA** | React 18, TypeScript, Vite, WebHID | Dashboard, request forms, Ledger connect/login/sign, audit views. Production image is nginx serving the SPA and reverse-proxying `/api` and `/health`. |
| **API Server** | Fastify, TypeScript, Drizzle | Auth (password + Ledger challenge), RBAC, request lifecycle, tx builder, signature verifier, config validation |
| **PostgreSQL** | Postgres 16 | Payment requests, signatures, audit events, job queue, auth challenges |
| **Broadcast Worker** | Node process (in API or separate) | Idempotent broadcast, confirmation polling |

### Deployment topology

| Environment | Compose file | What runs |
|---|---|---|
| Local | `docker-compose.yml` | Postgres 16 + API (`tsx watch`) + Web (Vite). Source bind-mounted for hot reload. |
| Production | `docker-compose.prod.yml` | API + nginx on `https://fboardpagec.com` (TLS via Let's Encrypt). nginx serves the SPA and reverse-proxies `/api` and `/health`. API is not published on the host. PostgreSQL is **external**; the API connects via `DATABASE_URL`. Certbot is a renewal sidecar, not a C4 application container. |

Images live in `apps/api/Dockerfile` and `apps/web/Dockerfile` (targets `development` / `production`). Ledger access is browser WebHID only — requires HTTPS (or localhost).

### Forbidden

- Backend accessing Ledger hardware
- Private keys anywhere in the system
- Arbitrary smart contract calls
- Standalone key management service

### Allowed (approved)

- Browser WebHID Ledger signing/login in the hosted SPA on user gesture; always close transport; never log APDU/secrets

---

## C3 — Component Map

### API (`apps/api`)

```text
src/
├── server.ts              # Fastify bootstrap
├── config/                # Env validation, policy config (USDT/limits)
├── routes/
│   ├── auth.ts
│   ├── config.ts
│   ├── admin-users.ts
│   ├── admin-treasury-config.ts
│   ├── payment-requests.ts
│   ├── signatures.ts
│   ├── broadcast.ts
│   ├── treasury.ts
│   ├── audit.ts
│   └── health.ts
├── services/
│   ├── payment-request.service.ts
│   ├── transaction-builder.service.ts
│   ├── signature-verifier.service.ts
│   ├── treasury-config.service.ts
│   ├── user.service.ts
│   ├── broadcast.service.ts
│   ├── audit.service.ts
│   └── tron-rpc.service.ts
├── db/
│   ├── schema/            # Drizzle tables
│   └── migrations/
└── workers/
    └── broadcast.worker.ts
```

### Web (`apps/web`)

```text
src/
├── pages/
│   ├── Dashboard.tsx
│   ├── NewPaymentRequest.tsx
│   ├── PaymentRequestDetail.tsx
│   ├── SigningQueue.tsx
│   ├── TreasuryHealth.tsx
│   ├── AdminTreasuryConfig.tsx
│   ├── AdminUsers.tsx
│   └── AuditLog.tsx
├── components/
├── ledger/                # WebHID Ledger (getAddress, signPersonalMessage, signTxHash)
├── hooks/
├── services/              # API client
└── lib/
```

### Shared (`packages/shared`)

```text
src/
├── types/                 # PaymentRequest, Signature, roles, statuses
├── canonical/             # Deterministic digest serialization + hash
├── tron/                  # Address validation, amount conversion, TRC-20 encode
├── state-machine/         # Payment request status transitions
└── constants.ts           # Allowed operations, network IDs
```

---

## C4 — Domain Flows

### User management (admin)

```text
Admin → Web UI /admin/users
  → GET /api/admin/users
  → Create: POST /api/admin/users (email, password, roles, optional signerAddress)
  → Update: PATCH /api/admin/users/:id (roles, signerAddress)
  → Reset password: POST /api/admin/users/:id/reset-password
  → Disable: DELETE /api/admin/users/:id (sets disabled_at; row kept for audit)
  → API enforces admin role, last-admin and self-disable guards
  → AuditEvent: USER_CREATED | USER_UPDATED | USER_PASSWORD_RESET | USER_DISABLED
  → Password reset bumps credentials_updated_at; JWTs issued before that second are rejected
```

### Treasury configuration (admin)

```text
Admin → Web UI /admin/treasury
  → GET /api/admin/treasury-config/discover?address=T...
  → API reads account.active_permission from TRON RPC
  → Admin selects Active Permission and chooses three Signer keys
  → PUT /api/admin/treasury-config
  → API re-reads chain, validates keys/weights/TriggerSmartContract
  → Upsert treasury_settings + app_config_state
  → AuditEvent: TREASURY_CONFIG_UPDATED
  → Hot-reload in-memory AppContext.config
```

### Payment Request Creation

```text
Requester → Web UI form
  → POST /api/payment-requests
  → API requires configValid (treasury configured + on-chain match)
  → API validates address, amount, policy
  → API reads on-chain USDT balance + permissions
  → TransactionBuilder creates USDT transfer tx
  → Store canonical payload + raw_data_hex + txID
  → Status: AWAITING_SIGNATURES
  → AuditEvent: REQUEST_CREATED
```

### Ledger Signing

```text
Signer → Web UI checkbox + "Sign with Ledger"
  → GET /api/payment-requests/:id/signing-payload
  → WebHID signTransactionHash on Ledger
  → POST /api/payment-requests/:id/signatures
  → API verifies ECDSA + getSignWeight
  → Status: PARTIALLY_SIGNED or READY_TO_BROADCAST
  → AuditEvent: SIGNATURE_ADDED
```

### Ledger Login

```text
Guest → "Sign in with Ledger"
  → POST /api/auth/ledger/challenge
  → WebHID signPersonalMessage
  → POST /api/auth/ledger/verify
  → Find or create user by signer_address (roles empty until Admin assigns)
  → JWT issued
```

### Broadcast

```text
Executor → Web UI final confirmation
  → POST /api/payment-requests/:id/broadcast
  → API re-validates: status, expiration, signatures, weight, permissions, balance
  → broadcasttransaction to TRON RPC
  → Status: BROADCASTED
  → Worker polls confirmation
  → Status: CONFIRMED (or BROADCAST_FAILED)
  → AuditEvent: BROADCAST_* 
```

---

## API Endpoints

```text
POST   /api/auth/login
POST   /api/auth/ledger/challenge
POST   /api/auth/ledger/verify
GET    /api/me

GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/:id
DELETE /api/admin/users/:id
POST   /api/admin/users/:id/reset-password

GET    /api/config/public
GET    /api/admin/treasury-config
GET    /api/admin/treasury-config/discover
PUT    /api/admin/treasury-config
POST   /api/admin/treasury-config/validate
GET    /api/treasury/health
GET    /api/treasury/permissions
GET    /api/treasury/balances

POST   /api/payment-requests
GET    /api/payment-requests
GET    /api/payment-requests/:id
POST   /api/payment-requests/:id/cancel
POST   /api/payment-requests/:id/reject

POST   /api/payment-requests/:id/signing-session
GET    /api/payment-requests/:id/signing-payload
POST   /api/payment-requests/:id/signatures

GET    /api/payment-requests/:id/sign-weight
POST   /api/payment-requests/:id/broadcast

GET    /api/audit-events
GET    /api/audit-events/export

GET    /health/live
GET    /health/ready
GET    /health/tron-rpc
```

---

## Where to Put New Code

| Feature | Frontend | Backend | Shared | DB |
|---|---|---|---|---|
| New page | `apps/web/src/pages/` | — | — | — |
| Admin users | `AdminUsersPage.tsx` | `user.service.ts` + admin user routes | — | `users` (`disabled_at`, `credentials_updated_at`) |
| Admin treasury config | `AdminTreasuryConfigPage.tsx` | `treasury-config.service.ts` + admin routes | — | `treasury_settings`, `app_config_state` |
| API endpoint | — | `apps/api/src/routes/` | — | migration if needed |
| Business logic | `apps/web/src/services/` | `apps/api/src/services/` | `packages/shared/` | — |
| TRON encoding | — | uses shared | `packages/shared/src/tron/` | — |
| Ledger interaction | `apps/web/src/ledger/` | **never** | — | — |
| State machine | — | uses shared | `packages/shared/src/state-machine/` | — |
| Audit | — | `apps/api/src/services/audit.service.ts` | — | `audit_events` table |
| Schema change | — | — | — | `apps/api/src/db/migrations/` append-only |

---

## Architecture Change Checklist

```text
[ ] User explicitly approved architecture change
[ ] docs/architecture.md updated
[ ] project-bible.md updated if invariants changed
[ ] .cursor/rules/architecture-c4.mdc updated if guardrails changed
[ ] No private keys introduced anywhere
[ ] Ledger access remains WebHID in apps/web only (never backend)
[ ] Canonical payload schema change has migration plan
[ ] Audit events for new mutating operations
[ ] Tests for new behavior
[ ] .env.example updated
```
