import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export function NewPaymentRequestPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const created = await api.createPaymentRequest({
        recipientAddress: String(form.get("recipientAddress")),
        amountDisplay: String(form.get("amountDisplay")),
        purpose: String(form.get("purpose")),
        externalReference: String(form.get("externalReference")),
        documentUrl: String(form.get("documentUrl") || "") || undefined,
        expirationMinutes: Number(form.get("expirationMinutes") || 30),
      });
      navigate(`/requests/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>New USDT payment request</h1>
      <div
        style={{
          background: "#fff3cd",
          border: "1px solid #ffc107",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <strong>TRON Mainnet warning:</strong> on-chain USDT transfers are irreversible.
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: 560 }}>
        <label>
          Recipient (full T… address)
          <input name="recipientAddress" required style={{ width: "100%" }} />
        </label>
        <label>
          Amount USDT
          <input name="amountDisplay" required placeholder="125.000000" />
        </label>
        <label>
          Purpose
          <textarea name="purpose" required rows={3} style={{ width: "100%" }} />
        </label>
        <label>
          External reference / invoice
          <input name="externalReference" required style={{ width: "100%" }} />
        </label>
        <label>
          Document URL (optional)
          <input name="documentUrl" type="url" style={{ width: "100%" }} />
        </label>
        <label>
          Expiration minutes (5–60)
          <input name="expirationMinutes" type="number" min={5} max={60} defaultValue={30} />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create request"}
        </button>
      </form>
    </div>
  );
}
