import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, formatAddress } from "../lib/api";
import {
  connectAndGetAddress,
  evaluateSigningEligibility,
  isWebHidSupported,
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
  const [deviceAddress, setDeviceAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<SigningEligibilityStatus | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      const { address } = await connectAndGetAddress();
      setDeviceAddress(address);

      const config = await api.publicConfig();
      const treasuryAddresses = Array.isArray(config.signers)
        ? (config.signers as Array<{ address?: string }>)
            .map((s) => s.address)
            .filter((a): a is string => Boolean(a))
        : [];

      const result = evaluateSigningEligibility({
        deviceAddress: address,
        profileAddress: user?.signerAddress ?? null,
        treasuryAddresses,
        hasSignerRole: hasRole("signer"),
        webHidSupported: true,
      });
      setStatus(result.status);
      setDetail(result.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

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
        Read your Ledger address via WebHID and check whether you can sign treasury
        payments. An admin must assign the Signer role and include your address in
        treasury settings.
      </p>
      <button type="button" onClick={onConnect} disabled={busy}>
        {busy ? "Connecting…" : "Connect Ledger"}
      </button>
      {deviceAddress && (
        <p style={{ fontFamily: "monospace" }}>
          Device: {formatAddress(deviceAddress)}
        </p>
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
