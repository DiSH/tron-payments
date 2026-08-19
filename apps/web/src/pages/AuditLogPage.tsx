import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function AuditLogPage() {
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .auditEvents()
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  function exportCsv() {
    const header = ["occurredAt", "eventType", "actorRole", "paymentRequestId"];
    const rows = events.map((e) =>
      header.map((key) => JSON.stringify(e[key] ?? "")).join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-events.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1>Audit log</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="button" onClick={exportCsv} style={{ marginBottom: "1rem" }}>
        Export CSV
      </button>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Time</th>
            <th align="left">Event</th>
            <th align="left">Role</th>
            <th align="left">Request</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={String(e.id)} style={{ borderTop: "1px solid #eee" }}>
              <td>{String(e.occurredAt)}</td>
              <td>{String(e.eventType)}</td>
              <td>{String(e.actorRole ?? "—")}</td>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                {String(e.paymentRequestId ?? "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
