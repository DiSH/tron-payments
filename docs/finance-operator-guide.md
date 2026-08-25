# Finance Operator Guide

## Create a payment request

1. Sign in to the web UI (email/password or **Sign in with Ledger**). Unlock the Ledger, open the Tron app, and choose the account if the device has several TRC-20 addresses.
2. Open **New request**.
3. Enter the full recipient TRON address, USDT amount, purpose, and invoice/reference.
4. Review the mainnet warning and submit.
5. Share the request link with other signers.

## Connect Ledger (eligibility check)

1. Plug in your Ledger, unlock it, and open the Tron app.
2. On the Dashboard or payment detail page, click **Connect Ledger**.
3. Allow the browser WebHID permission when prompted.
4. If the device has several TRC-20 accounts, select the address you use for treasury signing from the list.
5. Review the status: you can sign only if the selected address matches your profile, is in the treasury allowlist, and your account has the Signer role.

If connection fails, the UI explains the usual fixes: unlock the Ledger, open the Tron app, close Ledger Live, or re-select the device in the browser prompt.

## Sign with Ledger

1. Open the request detail page.
2. Verify recipient, amount, token (USDT TRC-20), purpose, and expiration.
3. Check the independent review checkbox.
4. Click **Sign with Ledger** — approve the transaction on the device in the same browser session.
5. Wait for the API to verify the signature and update sign weight.

You never enter seed phrases or private keys into the web app.

## Broadcast

1. After two valid signatures (weight ≥ 2), an executor clicks **Broadcast**.
2. Confirm the final summary.
3. Track status until **CONFIRMED** and open the TronScan link.

## Browser requirements

WebHID requires Chrome or Edge over **HTTPS** (production) or **localhost** (local Vite). Firefox WebHID support is out of MVP scope.
