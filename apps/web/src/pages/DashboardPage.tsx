import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export function DashboardPage() {
  const { hasRole } = useAuth();
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [balances, setBalances] = useState<Record<string, unknown> | null>(null);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.publicConfig(),
      api.treasuryBalances().catch(() => null),
      api.listPaymentRequests(),
    ])
      .then(([cfg, bal, reqs]) => {
        setConfig(cfg);
        setBalances(bal);
        setRequests(reqs.slice(0, 10));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const pending = requests.filter((r) =>
    ["AWAITING_SIGNATURES", "PARTIALLY_SIGNED", "READY_TO_BROADCAST"].includes(
      String(r.status),
    ),
  );

  const configured = config?.configured !== false && Boolean(config?.treasuryAddress);

  return (
    <div>
      <h1>Dashboard</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {!config?.configValid && (
        <div
          style={{
            background: "#fdecea",
            border: "1px solid #f5c2c7",
            padding: "1rem",
            marginBottom: "1rem",
          }}
        >
          <strong>Critical:</strong>{" "}
          {configured
            ? "Treasury configuration validation failed. New requests and broadcast are blocked."
            : "Treasury is not configured. New requests and broadcast are blocked."}
          {hasRole("admin") && (
            <>
              {" "}
              <Link to="/admin/treasury">Configure treasury →</Link>
            </>
          )}
        </div>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
          <h2>Treasury</h2>
          <p>Network: {String(config?.network ?? "—")}</p>
          <p>Address: {String(config?.treasuryAddress ?? "—")}</p>
          <p>Threshold: {String(config?.threshold ?? "—")}</p>
          <p>USDT balance: {String(balances?.usdtBalance ?? "—")}</p>
          <p>TRX balance: {String(balances?.trxBalance ?? "—")}</p>
        </div>
        <div style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
          <h2>Pending actions</h2>
          {pending.length === 0 ? (
            <p>No pending requests.</p>
          ) : (
            <ul>
              {pending.map((r) => (
                <li key={String(r.id)}>
                  <Link to={`/requests/${r.id}`}>
                    #{String(r.sequenceNumber)} — {String(r.status)} —{" "}
                    {String(r.amountDisplay)} USDT
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
