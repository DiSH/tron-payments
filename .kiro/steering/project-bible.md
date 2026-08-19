---
inclusion: always
status: living-document
product: TRON Payments
owner: Finance / Engineering
last_reviewed: 2026-08-19
---

# TRON Payments — Project Bible

Authoritative reference for AI agents, Cursor, and human contributors working on the **TRON multisig 2-of-3 USDT treasury** MVP.

Read this document **before** making any change. If this document conflicts with running code, migrations, or production behavior, stop and explicitly document the mismatch before changing anything.

---

## 0. Document Purpose

This bible captures:

1. **Product scope** — what the MVP does and explicitly does not do.
2. **Security invariants** — non-negotiable rules around keys, signing, and broadcast.
3. **Domain model** — payment requests, signatures, audit events, roles.
4. **Agent workflow** — how coding agents inspect, plan, implement, validate, and document changes.
5. **Technology choices** — stack, monorepo layout, devbox environment.
6. **Definition of Done** — acceptance criteria before work is considered complete.

The original technical specification (TZ) is the source requirement set; this bible is the operational SSOT for day-to-day development.

---

## 1. Product Definition

### 1.1 Purpose

Internal tool for **remote coordination and execution of USDT TRC-20 payments** from a single corporate TRON treasury address using on-chain **2-of-3 multisig**.

Three finance operators in different locations must be able to:

1. Create a payment request.
2. Independently review payment details.
3. Sign the **same TRON transaction** with their Ledger devices.
4. Collect two of three signatures.
5. Verify signatures belong to allowlisted keys and meet the weight threshold.
6. Broadcast to TRON mainnet only after threshold is reached.
7. Maintain an immutable audit log of requests, signatures, and on-chain results.

### 1.2 MVP Scope (In)

| Dimension | Value |
|---|---|
| Network | TRON Mainnet only |
| Treasury | One preconfigured address |
| Token | USDT TRC-20 only |
| Operation | `transfer(address,uint256)` only |
| Permission | One Active Permission group on treasury |
| Signers | Three pre-registered Ledger signer addresses |
| Threshold | 2 of 3 |

### 1.3 MVP Scope (Out)

Do **not** implement in MVP:

- Swaps, bridges, DeFi, staking
- Arbitrary smart contract calls
- TRX transfers
- Changing owners/permissions on-chain
- Multi-network support
- Mobile apps
- Batch/mass payouts
- Arbitrary raw transaction upload via UI
- User-supplied calldata

### 1.4 On-Chain Preconditions (configured outside MVP)

Treasury must already have TRON native permissions:

```text
Owner Permission:
  Signer A — weight 1
  Signer B — weight 1
  Signer C — weight 1
  threshold = 2

Active Permission (Treasury payments):
  Signer A — weight 1
  Signer B — weight 1
  Signer C — weight 1
  threshold = 2
  allows TriggerSmartContract
```

MVP **reads and verifies** these permissions at startup and before each payment. It **never modifies** them.

---

## 2. Security Invariants (Non-Negotiable)

These rules override convenience, speed, and feature requests.

### 2.1 Key Material

| Rule | Detail |
|---|---|
| **No secrets in system** | Seed phrases, private keys, PINs, keystore files, Ledger secrets must **never** enter app, server, browser form, DB, logs, or analytics |
| **Ledger-only signing** | Signature created only on physical Ledger with Tron app open |
| **Server cannot sign** | Backend must have no technical ability to sign payments |
| **No browser key access** | Web UI never receives private keys |
| **Local HID transport** | Signer client connects to Ledger via USB/HID locally |
| **Immutable payload** | All signatures bind to one canonical transaction payload |
| **No post-signature edits** | Recipient, amount, token, treasury, permission ID, expiration cannot change after first signature |
| **Threshold gate** | Broadcast only after independent verification of weight ≥ 2 |
| **No raw tx upload** | UI must not accept arbitrary raw transactions or calldata |

### 2.2 Explicit Prohibitions for Coding Agents

Agents must **never**:

- Ask users to enter seed phrase, private key, or PIN
- Use private keys in backend, frontend, CLI config, `.env`, or production test code
- Give backend access to user's Ledger
- Sign via `tronWeb.trx.multiSign(..., privateKey, ...)` in production paths
- Accept arbitrary raw transactions or smart contract methods from UI
- Allow on-chain permission changes through MVP
- Use `float` or JavaScript `number` for USDT amounts
- Broadcast without server-side signature verification and verified weight ≥ 2
- Auto-retry broadcast on ambiguous results
- Move mainnet funds before testnet POC and acceptance tests pass

### 2.3 Logging Restrictions

**Do not log:** seed phrases, private keys, PIN, full USB/APDU debug packets, access tokens, unnecessary PII.

**Do log:** request ID, txID, payload hash, signer public address, timestamp, role/action, verified weight, broadcast result, confirmation status, RPC error codes.

---

## 3. Development Environment

### 3.1 Devbox (Required)

All development runs inside **devbox**, consistent with other XPN projects (e.g. Product Cult).

```bash
devbox shell          # enter environment
devbox run install    # npm install (all workspaces)
devbox run docker:up  # start PostgreSQL
devbox run dev        # start all dev servers
```

Canonical commands are in `devbox.json` shell scripts and root `package.json`. Agents should prefer `devbox run <script>` over ad-hoc global tool versions.

### 3.2 Monorepo Layout

```text
tron-payments/
├── apps/
│   ├── api/       # Fastify backend — transaction builder, verifier, broadcast
│   ├── web/       # React SPA — dashboard, requests, signing UI
│   └── signer/    # Local Ledger client — USB/HID, never deployed to server
├── packages/
│   └── shared/    # Types, canonical hash, TRON helpers, state machine
├── docs/          # Architecture, threat model, runbooks
├── scripts/       # Config validation, POC utilities
├── .kiro/steering/ # Project bible (this file)
└── .cursor/rules/  # Agent rules
```

### 3.3 Environments

| Environment | Network | Purpose |
|---|---|---|
| `local` | testnet or mocked RPC | Development |
| `testnet` | TRON testnet (Nile/Shasta) | POC, acceptance tests |
| `staging` | testnet or mainnet read-only | Pre-production |
| `mainnet` | TRON mainnet | Production treasury |

**Rule:** No mainnet payments until testnet POC + acceptance suite pass.

### 3.4 Stack

| Layer | Choice |
|---|---|
| Backend | TypeScript, Node.js 22, Fastify |
| Web UI | React, TypeScript, Vite |
| Database | PostgreSQL 16 |
| ORM / migrations | Drizzle |
| TRON SDK | `tronweb` |
| Ledger | `@ledgerhq/hw-app-trx` + WebHID/HID transport |
| Queues (MVP) | DB-backed job table |
| Deployment | Docker Compose |
| Package manager | npm (lockfile committed) |

---

## 4. Roles and RBAC

Roles are stored in DB, not hardcoded in UI.

| Role | Capabilities | Restrictions |
|---|---|---|
| **Requester** | Create payment request drafts | Cannot edit payload after first signature; cannot broadcast without threshold |
| **Signer A/B/C** | Review and sign with Ledger | Only own allowlisted address; no access to others' keys |
| **Executor** | Broadcast after threshold | Cannot modify payload; may overlap with Signer |
| **Admin** | Users, config, reference data | Cannot sign as finance signer; cannot change on-chain permissions |
| **Auditor** | Read-only view of requests, signatures, hashes | No create/sign/broadcast |

MVP allows Requester + Signer role combination for same user.

---

## 5. Architecture Summary

See `docs/architecture.md` for full C4 diagrams. Summary:

```text
Web UI (React)
  └─ HTTPS API (Fastify)
       ├─ PostgreSQL (requests, signatures, audit)
       ├─ TRON RPC client
       ├─ Transaction builder (USDT transfer only)
       ├─ Signature verifier (ECDSA recovery)
       ├─ On-chain permission/weight verifier
       └─ Broadcast worker

Local Signer Client (per finance operator)
  ├─ Auth to API
  ├─ Fetch canonical payload
  ├─ Local re-validation
  ├─ USB/HID → Ledger Tron app
  └─ Submit signature + metadata only
```

**Critical separation:** Ledger interaction happens **only** in `apps/signer`, running locally on the signer's machine. Backend and Web UI never touch Ledger hardware.

---

## 6. Domain Model

### 6.1 PaymentRequest

Core entity. Key fields:

- Identity: `id`, `sequence_number`, `status`
- Chain context: `network`, `treasury_address`, `permission_id`
- Token: `token_contract_address`, `token_symbol`, `token_decimals`
- Payment: `recipient_address`, `amount_raw`, `amount_display`, `purpose`, `external_reference`, `document_url`
- Transaction: `raw_data_hex`, `tx_id`, `canonical_payload_json`, `canonical_payload_hash`, `expiration_at`
- Lifecycle: `created_by`, timestamps, `broadcast_tx_id`, `failure_reason`, `version` (optimistic locking)

### 6.2 Signature

- `payment_request_id`, `signer_address`, `signature_hex`, `recovered_address`
- `payload_hash`, `tx_id`, `signer_user_id`
- `verification_result`, `created_at`
- Optional: `ledger_device_metadata`

**Rule:** Max one active signature per signer address per request. Server recovers signer address from signature — never trusts client-supplied address alone.

### 6.3 AuditEvent

Append-only. No UPDATE/DELETE on historical events (enforce at DB permission level).

- `event_type`, `actor_user_id`, `actor_role`
- `payment_request_id`, `before_state_json`, `after_state_json`
- `ip_address`, `user_agent`, `correlation_id`, `immutable_event_hash`

### 6.4 Status State Machine

```text
DRAFT
  → AWAITING_SIGNATURES
  → PARTIALLY_SIGNED
  → READY_TO_BROADCAST
  → BROADCASTING
  → BROADCASTED → CONFIRMED
  → BROADCAST_FAILED / EXPIRED / CANCELLED_IN_APP / REJECTED
```

Implement as explicit state machine with tested transitions. No ad-hoc status assignments.

---

## 7. Payment Flow

### 7.1 Request Creation

Requester provides: recipient (T…), USDT amount (max 6 decimals), purpose, external reference, optional document URL, expiration (default 30 min, max 60 min).

Backend must:

1. Validate Base58Check TRON address.
2. Block payments to treasury/signer addresses (unless admin override).
3. Convert amount to integer base units without float (`amountRaw = amount × 10^6`).
4. Check max payment policy and on-chain USDT balance.
5. Check TRX/energy availability; surface cost estimate.
6. Build **only** `transfer(address,uint256)` on allowlisted USDT contract.
7. Set correct `permission_id` and `expiration`.
8. Store immutable canonical payload, `raw_data_hex`, `txID`, payload hash.
9. Transition to `AWAITING_SIGNATURES`.

After first signature: **no edits**. New payment = new request + new txID.

### 7.2 Signing Flow

1. Signer checks independent verification checkbox in Web UI (logged to audit, not a crypto signature).
2. Web UI opens local signer client with request ID + short-lived signing token.
3. Signer client downloads canonical payload from API.
4. Client re-validates all fields locally.
5. Full-screen review → Ledger connect → Tron app → sign raw transaction bytes.
6. Client verifies recovered address matches authorized signer.
7. Client submits `{ requestId, signature, txId, payloadHash, signedAt }` to API.
8. Server verifies signature cryptographically, checks on-chain weight via `getSignWeight`.

### 7.3 Broadcast Flow

Allowed only when: status `READY_TO_BROADCAST`, not expired, payload unchanged, signatures verified, on-chain weight ≥ 2, treasury permissions still match config, balances sufficient.

Executor confirms → backend broadcasts → worker waits for confirmation → status update + TronScan link.

Broadcast is idempotent. No silent retries.

### 7.4 Cancellation and Expiration

- Before first signature: requester can cancel.
- After first signature: only `CANCELLED_IN_APP` (signatures remain valid cryptographically but UI stops offering signing).
- Short on-chain expiration makes stale transactions invalid.
- Expired requests get status `EXPIRED`. Retry = new request.

---

## 8. Canonical Payment Digest

Deterministic serialization and hash. Same fields → same hash.

```json
{
  "network": "tron-mainnet",
  "treasuryAddress": "T...",
  "permissionId": 2,
  "token": {
    "symbol": "USDT",
    "contractAddress": "T...",
    "decimals": 6
  },
  "operation": "transfer(address,uint256)",
  "recipient": "T...",
  "amountRaw": "125000000",
  "amountDisplay": "125.000000",
  "expiration": "ISO-8601",
  "requestId": "pay_..."
}
```

Implementation lives in `packages/shared`. Must have unit tests for determinism.

---

## 9. Configuration

All critical parameters are server-side, read-only in UI. See `.env.example`.

### 9.1 Startup Validation

On every backend start (and before each new request/broadcast):

- Treasury address exists on-chain
- Active Permission ID exists with threshold = 2
- Signer keys/weights match config A/B/C
- Active Permission allows `TriggerSmartContract`
- USDT contract address matches expected
- Network is mainnet (in production)
- TRX balance sufficient (or warn)

**Mismatch → block** new requests and broadcast; show critical error to admin/auditor.

---

## 10. API Contract

Base path: `/api`. See architecture doc for full endpoint list.

### 10.1 Critical Invariants

- `signing-payload` accessible only to authorized allowlisted signer
- Signing token: one-time, short-lived, bound to request + user + signer address
- `POST /signatures`: recover signer address from ECDSA — do not trust client address
- `POST /broadcast`: idempotent
- All mutating endpoints: CSRF protection, audit event, RBAC
- State changes: optimistic locking via `version` field

### 10.2 Health Endpoints

```text
GET /health/live
GET /health/ready
GET /health/tron-rpc
```

---

## 11. Ledger Integration

### 11.1 Requirements

- Library: `@ledgerhq/hw-app-trx`
- Transport: WebHID or HID (local only, in `apps/signer`)
- Derivation path explicitly mapped to signer address in config
- Handle: device not connected, wrong device, Tron app closed, user rejection, locked device, Ledger Live conflict, USB timeout, unsupported app version

### 11.2 Proof of Concept (Mandatory Gate)

Before full MVP development, complete and document testnet POC:

1. Build test transaction with Active Permission ID
2. Sign raw tx via Ledger TRON app
3. Recover signer address from signature
4. Match with Ledger-reported address
5. Add signatures from two different Ledgers
6. Verify weight via TRON node
7. Broadcast to testnet
8. Verify in block explorer

**If POC fails → stop MVP development until resolved.**

POC artifacts: `scripts/ledger-poc/` or `docs/ledger-poc-report.md`.

---

## 12. Web UI Requirements

### 12.1 Pages

1. **Dashboard** — treasury balances, permission health, pending actions, warnings
2. **New Request** — form with digest preview
3. **Request Detail** — full summary, signatures, weight, audit timeline, role-based actions
4. **Signing Queue** — pending requests sorted by expiration
5. **Treasury Health** — on-chain permissions, balances, RPC status
6. **Audit** — filters, CSV export

### 12.2 UX Rules

- Show full addresses by default or one-click expand
- Copy buttons for addresses
- Separate full-screen review before sign and broadcast
- Prominent mainnet warnings
- Sign button disabled until independent verification checkbox checked
- No auto-fill recipient from clipboard/history without confirmation
- Show USDT amount + raw units in technical details
- No silent broadcast retries

---

## 13. Agent Workflow

### 13.1 Before Coding

1. Read this bible — sections relevant to your task.
2. Read `docs/architecture.md` for affected C3/C4 components.
3. Read `AGENTS.md` for commands and environment.
4. Confirm task does not violate §2 security invariants.

### 13.2 Implementation Rules

1. **Minimal diff** — no drive-by refactors or unrelated changes.
2. **Shared logic in `packages/shared`** — canonical hash, state machine, TRON address validation, amount conversion.
3. **Test real behavior** — unit tests for hash, state machine, signature recovery, amount conversion; integration tests for RPC/permissions.
4. **Append-only migrations** — never edit existing migration files.
5. **Secrets never in repo** — use `.env` (gitignored) and `.env.example` (no secrets).
6. **Audit everything mutating** — every state change creates an AuditEvent.
7. **No float for money** — use `bigint` or decimal string libraries.

### 13.3 Architecture Change Gate

**Ask the user first** before:

- Adding a new deployable container
- Changing signing model (e.g. browser-based Ledger access)
- Adding new token/operation types
- Introducing private key handling anywhere
- Changing canonical payload schema (requires migration plan for in-flight requests)

After approval, update in same change set:

1. `docs/architecture.md`
2. This bible (relevant sections)
3. `.cursor/rules/architecture-c4.mdc`
4. `AGENTS.md` if commands change

---

## 14. Testing Strategy

### 14.1 Unit Tests (Required)

- TRON address validation
- Decimal-to-raw USDT conversion (no float errors)
- `transfer(address,uint256)` encoding
- Canonical serialization/hash determinism
- Permission ID validation
- Signature recovery and verification
- State machine transitions
- Idempotency, expiration, duplicate signer rejection
- Reject signature for altered fields

### 14.2 Integration Tests (Required)

- TRON RPC connectivity
- On-chain permission verification
- TRC-20 transfer construction
- `getSignWeight` with 0, 1, 2 signatures
- Broadcast flow
- Insufficient TRX/energy handling
- Expired transaction rejection
- Changed on-chain permissions detection

### 14.3 Acceptance Tests (Testnet, Manual + Documented)

Full matrix from TZ §15.3 must pass before mainnet.

### 14.4 Mainnet Rollout

1. Staging/testnet: 10+ successful cycles with pairs A/B, A/C, B/C
2. Independent code review
3. Mainnet with minimum amount limit
4. One small mainnet USDT transfer
5. Increase limits only after operational review

---

## 15. Definition of Done

Work is complete when:

- [ ] Code matches this bible and architecture doc
- [ ] Security invariants (§2) not violated
- [ ] Unit tests pass for changed logic
- [ ] Integration tests pass (or documented skip with reason)
- [ ] Audit events emitted for state changes
- [ ] No secrets in diff
- [ ] `.env.example` updated if new config added
- [ ] Docs updated if behavior/architecture changed
- [ ] Lint passes on touched files

MVP acceptance criteria (§16) are release gates, not per-PR gates.

---

## 16. MVP Acceptance Criteria

MVP is ready only when **all** are true:

- [ ] Treasury on-chain: Active Permission A/B/C, weights 1/1/1, threshold 2
- [ ] Full path tested with two Ledgers on different machines/locations
- [ ] No seed phrase or private key enters the system
- [ ] Single signer cannot broadcast
- [ ] Second signer sees full payment details before signing
- [ ] Payload immutable after first signature
- [ ] Backend verifies signatures and on-chain weight before broadcast
- [ ] Broadcast impossible at weight < 2
- [ ] Immutable audit trail exists
- [ ] Transaction expiration works
- [ ] Testnet acceptance suite passed
- [ ] Test mainnet transfer on limited amount completed
- [ ] Finance operator guide requires no seed phrases or raw transaction handling

---

## 17. Required Deliverables

1. Source: `apps/api`, `apps/web`, `apps/signer`, `packages/shared`
2. Docker Compose for local/staging
3. `.env.example`
4. DB migrations (Drizzle)
5. Config validation script
6. Ledger TRON testnet POC
7. Automated unit/integration tests
8. Developer guide (`docs/developer-guide.md`)
9. Admin deployment runbook (`docs/admin-runbook.md`)
10. Finance operator guide (`docs/finance-operator-guide.md`)
11. Threat model (`docs/threat-model.md`)
12. Known MVP limitations (`docs/known-limitations.md`)
13. Testnet acceptance report (`docs/testnet-acceptance-report.md`)

---

## 18. Decision Hierarchy

When sources conflict:

1. Production runtime behavior and applied migrations
2. Security invariants (§2)
3. **This document** (project bible)
4. `docs/architecture.md`
5. Feature specs under `.kiro/specs/` or `docs/`
6. Source code, README

---

## 19. References

- Ledger TRON app: `@ledgerhq/hw-app-trx`
- TRON transaction API: TronWeb + TRON HTTP API
- Multisig: `permissionId`, `getSignWeight`, `broadcasttransaction`
- USDT TRC-20: allowlisted contract, method `transfer(address,uint256)`
