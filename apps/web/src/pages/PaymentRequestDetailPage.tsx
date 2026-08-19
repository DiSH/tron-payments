import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api, copyToClipboard } from "../lib/api";

export function PaymentRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRole, user } = useAuth();
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [weight, setWeight] = useState<Record<string, unknown> | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getPaymentRequest(id), api.getSignWeight(id).catch(() => null)])
      .then(([req, w]) => {
        setRecord(req);
        setWeight(w);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [id]);

  if (!id) return null;
  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!record) return <p>Loading…</p>;

  const canSign = hasRole("signer_a", "signer_b", "signer_c");
  const canBroadcast = hasRole("executor");

  async function handleSign() {
    if (!reviewConfirmed) {
      setError("Confirm independent review before signing");
      return;
    }
    setError(null);
    try {
      const session = await api.createSigningSession(id);
      const authToken = localStorage.getItem("auth_token");
      const url = new URL(session.signerClientUrl);
      url.searchParams.set("authToken", authToken ?? "");
      url.searchParams.set("expectedSignerAddress", user?.signerAddress ?? "");
      window.open(url.toString(), "_blank", "noopener,noreferrer");
      setMessage("Signer client opened. Complete Ledger approval locally.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleBroadcast() {
    if (!window.confirm("Broadcast this payment to TRON mainnet?")) return;
    try {
      await api.broadcast(id);
      setMessage("Broadcast submitted");
      const refreshed = await api.getPaymentRequest(id);
      setRecord(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div>
      <p>
        <Link to="/">← Dashboard</Link>
      </p>
      <h1>Payment request #{String(record.sequenceNumber)}</h1>
      <p>
        Status: <strong>{String(record.status)}</strong>
      </p>

      <section style={{ display: "grid", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <div>
          Recipient: {String(record.recipientAddress)}{" "}
          <button type="button" onClick={() => copyToClipboard(String(record.recipientAddress))}>
            Copy
          </button>
        </div>
        <div>Amount: {String(record.amountDisplay)} USDT ({String(record.amountRaw)} raw)</div>
        <div>Purpose: {String(record.purpose)}</div>
        <div>Reference: {String(record.externalReference)}</div>
        <div>TX ID: {String(record.txId)}</div>
        <div>Payload hash: {String(record.canonicalPayloadHash)}</div>
        <div>Expiration: {String(record.expirationAt)}</div>
        {weight && (
          <div>
            Sign weight: {String(weight.currentWeight)} / {String(weight.threshold)}
          </div>
        )}
      </section>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {canSign &&
        ["AWAITING_SIGNATURES", "PARTIALLY_SIGNED"].includes(String(record.status)) && (
          <section
            style={{
              border: "2px solid #333",
              padding: "1rem",
              marginBottom: "1rem",
              background: "#fafafa",
            }}
          >
            <h2>Sign with Ledger</h2>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={reviewConfirmed}
                onChange={(e) => setReviewConfirmed(e.target.checked)}
              />
              I independently verified recipient, amount, USDT TRC-20, purpose, and expiration.
            </label>
            <button
              type="button"
              style={{ marginTop: "0.75rem" }}
              disabled={!reviewConfirmed}
              onClick={handleSign}
            >
              Sign with Ledger
            </button>
          </section>
        )}

      {canBroadcast && record.status === "READY_TO_BROADCAST" && (
        <button type="button" onClick={handleBroadcast}>
          Broadcast
        </button>
      )}
    </div>
  );
}
