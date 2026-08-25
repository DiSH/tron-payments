import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { LedgerAccountPicker } from "./LedgerAccountPicker";
import {
  evaluateSigningEligibility,
  isWebHidSupported,
  listLedgerAccounts,
  pickPreferredAccount,
  setStoredDerivationPath,
  type LedgerAccount,
  type SigningEligibilityStatus,
} from "../ledger/tron-webhid";

const STATUS_COLOR: Record<SigningEligibilityStatus, string> = {
  can_sign: "green",
  address_mismatch: "crimson",
  not_in_treasury: "crimson",
  missing_signer_role: "darkorange",
  no_profile_address: "darkorange",
  unsupported_browser: "crimson",
};

export function ConnectLedgerButton() {
  const { user, hasRole } = useAuth();
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [treasuryAddresses, setTreasuryAddresses] = useState<string[]>([]);
  const [status, setStatus] = useState<SigningEligibilityStatus | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyEligibility(address: string, treasury: string[]) {
    const result = evaluateSigningEligibility({
      deviceAddress: address,
      profileAddress: user?.signerAddress ?? null,
      treasuryAddresses: treasury,
      hasSignerRole: hasRole("signer"),
      webHidSupported: true,
    });
    setStatus(result.status);
    setDetail(result.detail);
  }

  function onSelectAccount(account: LedgerAccount) {
    setSelectedPath(account.derivationPath);
    setStoredDerivationPath(account.derivationPath);
    applyEligibility(account.address, treasuryAddresses);
  }

  async function onConnect() {
    setBusy(true);
    setError(null);
    setStatus(null);
    setDetail(null);
    try {
      if (!isWebHidSupported()) {
        const result = evaluateSigningEligibility({
          deviceAddress: null,
          profileAddress: user?.signerAddress ?? null,
          treasuryAddresses: [],
          hasSignerRole: hasRole("signer"),
          webHidSupported: false,
        });
        setStatus(result.status);
        setDetail(result.detail);
        return;
      }

      const listed = await listLedgerAccounts();
      const preferred = pickPreferredAccount(listed, user?.signerAddress ?? null);
      setAccounts(listed);
      setSelectedPath(preferred?.derivationPath ?? null);
      if (preferred) {
        setStoredDerivationPath(preferred.derivationPath);
      }

      const config = await api.publicConfig();
      const nextTreasury = Array.isArray(config.signers)
        ? (config.signers as Array<{ address?: string }>)
            .map((s) => s.address)
            .filter((a): a is string => Boolean(a))
        : [];
      setTreasuryAddresses(nextTreasury);

      if (preferred) {
        applyEligibility(preferred.address, nextTreasury);
      }
    } catch (err) {
      setAccounts([]);
      setSelectedPath(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const selected = accounts.find((account) => account.derivationPath === selectedPath);

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "1rem",
        marginBottom: "1rem",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Connect Ledger</h2>
      <p style={{ color: "#555", marginTop: 0 }}>
        Unlock your Ledger, open the Tron app, then connect via WebHID. Choose the
        account if you have several TRC-20 addresses. An admin must assign the
        Signer role and include your address in treasury settings.
      </p>
      <button type="button" onClick={onConnect} disabled={busy}>
        {busy ? "Connecting…" : "Connect Ledger"}
      </button>
      {selectedPath && accounts.length > 0 && (
        <LedgerAccountPicker
          accounts={accounts}
          selectedPath={selectedPath}
          onSelect={onSelectAccount}
        />
      )}
      {selected && (
        <p style={{ fontFamily: "monospace" }}>Device: {selected.address}</p>
      )}
      {status && detail && (
        <p style={{ color: STATUS_COLOR[status] }}>
          <strong>{status.replaceAll("_", " ")}</strong> — {detail}
        </p>
      )}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </section>
  );
}
