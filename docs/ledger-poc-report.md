# Ledger TRON POC Report

> Fill this document after running the testnet POC with physical Ledger devices.

## Environment

| Field | Value |
|---|---|
| Date | |
| Network | tron-testnet |
| TRON RPC | |
| Treasury address | |
| Active permission ID | |
| Ledger Tron app version | |
| `@ledgerhq/hw-app-trx` version | |

## Checklist (from project bible §11.2)

- [ ] Built test transaction with Active Permission ID
- [ ] Signed raw tx via Ledger TRON app
- [ ] Recovered signer address from signature
- [ ] Matched recovered address with Ledger-reported address
- [ ] Added signatures from two different Ledgers
- [ ] Verified weight via TRON node (`getSignWeight`)
- [ ] Broadcast to testnet
- [ ] Verified in block explorer

## Commands

```bash
devbox run docker:up
devbox run db:migrate
# Configure treasury via Admin → Treasury Settings (web UI), then:
devbox run validate:config
tsx scripts/ledger-poc/run-poc.ts
# Sign via WebHID in the web UI (Chrome/Edge, Ledger + Tron app open)
```

## Results

### Step 1 — Build unsigned transaction

```
(paste txID, payload hash, raw_data_hex)
```

### Step 2 — Ledger A signature

```
(signer address, signature hex, recovered address)
```

### Step 3 — Ledger B signature

```
(signer address, signature hex, getSignWeight result)
```

### Step 4 — Broadcast

```
(broadcast result, explorer link)
```

## Issues encountered

_Document device errors, permission mismatches, or library incompatibilities here._

## Conclusion

- [ ] POC passed — proceed with full MVP
- [ ] POC failed — block mainnet until resolved
