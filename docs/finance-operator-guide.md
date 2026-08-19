# Finance Operator Guide

## Create a payment request

1. Sign in to the web UI.
2. Open **New request**.
3. Enter the full recipient TRON address, USDT amount, purpose, and invoice/reference.
4. Review the mainnet warning and submit.
5. Share the request link with other signers.

## Sign with Ledger

1. Open the request detail page.
2. Verify recipient, amount, token (USDT TRC-20), purpose, and expiration.
3. Check the independent review checkbox.
4. Click **Sign with Ledger** — this opens the local signer client on your machine.
5. Connect Ledger, unlock it, and open the Tron app.
6. Confirm the payment on the device.

You never enter seed phrases or private keys into the web app.

## Broadcast

1. After two valid signatures (weight ≥ 2), an executor clicks **Broadcast**.
2. Confirm the final summary.
3. Track status until **CONFIRMED** and open the TronScan link.

## Local signer client

Run on the signer's computer only:

```bash
devbox run dev:signer
```

Default URL: `http://127.0.0.1:3847`
