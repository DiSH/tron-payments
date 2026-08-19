import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function TreasuryHealthPage() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [balances, setBalances] = useState<Record<string, unknown> | null>(null);
  const [permissions, setPermissions] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.treasuryHealth(),
      api.treasuryBalances(),
      api.publicConfig(),
    ])
      .then(([h, b, cfg]) => {
        setHealth(h);
        setBalances(b);
        setPermissions(cfg);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div>
      <h1>Treasury health</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <section style={{ marginBottom: "1.5rem" }}>
        <h2>Validation</h2>
        <pre style={{ background: "#f5f5f5", padding: "1rem", overflow: "auto" }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2>Balances</h2>
        <pre style={{ background: "#f5f5f5", padding: "1rem" }}>
          {JSON.stringify(balances, null, 2)}
        </pre>
      </section>

      <section>
        <h2>Configured signers</h2>
        <pre style={{ background: "#f5f5f5", padding: "1rem" }}>
          {JSON.stringify(permissions, null, 2)}
        </pre>
      </section>
    </div>
  );
}
