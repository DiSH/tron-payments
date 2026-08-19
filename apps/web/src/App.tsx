import { PROJECT_NAME } from "@tron-payments/shared";

export function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>TRON Payments</h1>
      <p>
        {PROJECT_NAME} — remote 2-of-3 multisig USDT treasury MVP
      </p>
      <p style={{ color: "#666" }}>
        Web UI skeleton. See <code>.kiro/steering/project-bible.md</code> for requirements.
      </p>
      <section
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          background: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: "4px",
        }}
      >
        <strong>⚠ TRON Mainnet</strong> — all payments are irreversible on-chain operations.
      </section>
    </main>
  );
}
