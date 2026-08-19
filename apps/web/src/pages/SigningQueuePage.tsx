import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export function SigningQueuePage() {
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listPaymentRequests()
      .then((items) =>
        setRequests(
          items
            .filter((r) =>
              ["AWAITING_SIGNATURES", "PARTIALLY_SIGNED"].includes(String(r.status)),
            )
            .sort(
              (a, b) =>
                new Date(String(a.expirationAt)).getTime() -
                new Date(String(b.expirationAt)).getTime(),
            ),
        ),
      )
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div>
      <h1>Signing queue</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {requests.length === 0 ? (
        <p>No requests awaiting signatures.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">#</th>
              <th align="left">Recipient</th>
              <th align="left">Amount</th>
              <th align="left">Purpose</th>
              <th align="left">Expires</th>
              <th align="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={String(r.id)} style={{ borderTop: "1px solid #eee" }}>
                <td>
                  <Link to={`/requests/${r.id}`}>{String(r.sequenceNumber)}</Link>
                </td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {String(r.recipientAddress)}
                </td>
                <td>{String(r.amountDisplay)} USDT</td>
                <td>{String(r.purpose)}</td>
                <td>{String(r.expirationAt)}</td>
                <td>{String(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
