import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  api,
  type DiscoveredPermission,
  type TreasuryConfigResponse,
} from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export function AdminTreasuryConfigPage() {
  const { hasRole } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existing, setExisting] = useState<TreasuryConfigResponse | null>(null);

  const [treasuryAddress, setTreasuryAddress] = useState("");
  const [permissions, setPermissions] = useState<DiscoveredPermission[]>([]);
  const [selectedPermissionId, setSelectedPermissionId] = useState<number | null>(
    null,
  );
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);
  const [labelByAddress, setLabelByAddress] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    api
      .adminTreasuryConfig()
      .then((cfg) => {
        setExisting(cfg);
        if (cfg.configured && cfg.config) {
          setTreasuryAddress(cfg.config.treasuryAddress);
          setSelectedPermissionId(cfg.config.activePermissionId);
          const labels: Record<string, string> = {};
          const addresses: string[] = [];
          for (const s of cfg.config.signers) {
            addresses.push(s.address);
            labels[s.address] = s.label;
          }
          setSelectedAddresses(addresses);
          setLabelByAddress(labels);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const selectedPermission = useMemo(
    () => permissions.find((p) => p.id === selectedPermissionId) ?? null,
    [permissions, selectedPermissionId],
  );

  const discover = async () => {
    setError(null);
    setSuccess(null);
    try {
      const result = await api.discoverTreasury(treasuryAddress.trim());
      if (!result.treasuryExists) {
        setError("Treasury address not found on-chain");
        return;
      }
      setPermissions(result.activePermissions);
      if (result.activePermissions.length === 0) {
        setError("No active permissions found on this account");
        return;
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const selectPermission = (id: number) => {
    setSelectedPermissionId(id);
    const perm = permissions.find((p) => p.id === id);
    if (!perm) return;

    const nextLabels: Record<string, string> = { ...labelByAddress };
    for (const [index, key] of perm.keys.entries()) {
      if (!nextLabels[key.address]) {
        nextLabels[key.address] = `Signer ${index + 1}`;
      }
    }
    const preselected =
      selectedAddresses.length === 3
        ? selectedAddresses.filter((a) =>
            perm.keys.some((k) => k.address === a),
          )
        : perm.keys.length === 3
          ? perm.keys.map((k) => k.address)
          : selectedAddresses.filter((a) =>
              perm.keys.some((k) => k.address === a),
            );
    setSelectedAddresses(preselected);
    setLabelByAddress(nextLabels);
    setStep(3);
  };

  const toggleAddress = (address: string) => {
    setSelectedAddresses((prev) => {
      if (prev.includes(address)) {
        return prev.filter((a) => a !== address);
      }
      if (prev.length >= 3) return prev;
      return [...prev, address];
    });
  };

  const mappingComplete = selectedAddresses.length === 3;

  const save = async () => {
    if (!selectedPermission || !mappingComplete) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const signers = selectedAddresses.map((address, index) => ({
        role: "signer" as const,
        address,
        label:
          labelByAddress[address]?.trim() || `Signer ${index + 1}`,
      }));

      const result = await api.saveTreasuryConfig({
        treasuryAddress: treasuryAddress.trim(),
        activePermissionId: selectedPermission.id,
        signers,
      });
      setExisting({
        configured: true,
        configValid: result.configValid,
        validationErrors: result.validationErrors,
        lastValidatedAt: null,
        config: {
          ...result.config,
          network: existing?.config?.network ?? "",
          usdtContractAddress: existing?.config?.usdtContractAddress ?? "",
        },
      });
      setSuccess("Treasury configuration saved and validated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!hasRole("admin")) {
    return <Navigate to="/" replace />;
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Treasury settings</h1>
      <p style={{ color: "#555", maxWidth: 640 }}>
        On-chain multisig is configured outside this app. Here you register the
        treasury address, pick the Active Permission used for payments, and select
        exactly three on-chain keys as allowlisted Signers.
      </p>

      {existing?.configured && existing.config && (
        <section
          style={{
            background: existing.configValid ? "#eef8ee" : "#fdecea",
            border: `1px solid ${existing.configValid ? "#b7dfb9" : "#f5c2c7"}`,
            padding: "1rem",
            marginBottom: "1.25rem",
            borderRadius: 8,
          }}
        >
          <strong>
            {existing.configValid ? "Configured & valid" : "Configured but invalid"}
          </strong>
          <p style={{ margin: "0.5rem 0 0" }}>
            {existing.config.treasuryAddress} · permission #
            {existing.config.activePermissionId} · threshold{" "}
            {existing.config.threshold}
          </p>
          {existing.validationErrors.length > 0 && (
            <ul>
              {existing.validationErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      <ol style={{ display: "flex", gap: "1rem", listStyle: "none", padding: 0 }}>
        {[1, 2, 3].map((n) => (
          <li
            key={n}
            style={{
              fontWeight: step === n ? 700 : 400,
              color: step === n ? "#111" : "#888",
            }}
          >
            Step {n}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section>
          <h2>1. Treasury address</h2>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Base58 address
            <input
              value={treasuryAddress}
              onChange={(e) => setTreasuryAddress(e.target.value)}
              placeholder="T..."
              style={{ display: "block", width: "100%", maxWidth: 480, marginTop: 4 }}
            />
          </label>
          <button type="button" onClick={discover} disabled={!treasuryAddress.trim()}>
            Discover permissions
          </button>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2>2. Select Active Permission</h2>
          <button type="button" onClick={() => setStep(1)} style={{ marginBottom: 12 }}>
            ← Back
          </button>
          {permissions.length === 0 ? (
            <p>No permissions discovered.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {permissions.map((p) => (
                <li
                  key={p.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: "1rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <strong>
                        #{p.id} — {p.name}
                      </strong>
                      <p style={{ margin: "0.25rem 0" }}>
                        Threshold {p.threshold} · {p.keys.length} keys ·{" "}
                        {p.allowsTriggerSmartContract
                          ? "TriggerSmartContract OK"
                          : "no TriggerSmartContract"}
                      </p>
                      <ul>
                        {p.keys.map((k) => (
                          <li key={k.address}>
                            {k.address} (weight {k.weight})
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectPermission(p.id)}
                      disabled={!p.allowsTriggerSmartContract || p.keys.length < 3}
                    >
                      Select
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 3 && selectedPermission && (
        <section>
          <h2>3. Select three Signer keys</h2>
          <button type="button" onClick={() => setStep(2)} style={{ marginBottom: 12 }}>
            ← Back
          </button>
          <p>
            Permission #{selectedPermission.id} — threshold{" "}
            {selectedPermission.threshold} (from chain, not editable)
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Include</th>
                <th align="left">On-chain key</th>
                <th align="left">Weight</th>
                <th align="left">Label</th>
              </tr>
            </thead>
            <tbody>
              {selectedPermission.keys.map((k) => {
                const included = selectedAddresses.includes(k.address);
                return (
                  <tr key={k.address}>
                    <td style={{ padding: "0.5rem 0" }}>
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => toggleAddress(k.address)}
                        disabled={!included && selectedAddresses.length >= 3}
                      />
                    </td>
                    <td style={{ padding: "0.5rem 0", fontFamily: "monospace" }}>
                      {k.address}
                    </td>
                    <td>{k.weight}</td>
                    <td>
                      <input
                        value={labelByAddress[k.address] ?? ""}
                        onChange={(e) =>
                          setLabelByAddress((prev) => ({
                            ...prev,
                            [k.address]: e.target.value,
                          }))
                        }
                        disabled={!included}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ color: "#666" }}>
            Select exactly three unique keys ({selectedAddresses.length}/3).
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!mappingComplete || saving}
          >
            {saving ? "Saving…" : "Validate & Save"}
          </button>
        </section>
      )}

      <p style={{ marginTop: "2rem" }}>
        <Link to="/treasury">View treasury health →</Link>
      </p>
    </div>
  );
}
