import type { LedgerAccount } from "../ledger/tron-webhid";

export function LedgerAccountPicker({
  accounts,
  selectedPath,
  onSelect,
  name = "ledger-account",
}: {
  accounts: LedgerAccount[];
  selectedPath: string;
  onSelect: (account: LedgerAccount) => void;
  name?: string;
}) {
  return (
    <fieldset
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "0.75rem",
        margin: "0.75rem 0 0",
      }}
    >
      <legend>Select TRON account</legend>
      <p style={{ color: "#555", marginTop: 0, fontSize: 13 }}>
        If you have several TRC-20 accounts on this Ledger, choose the address you
        use for treasury signing.
      </p>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {accounts.map((account) => (
          <label
            key={account.derivationPath}
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "flex-start",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name={name}
              checked={account.derivationPath === selectedPath}
              onChange={() => onSelect(account)}
            />
            <span>
              <strong>Account {account.accountIndex + 1}</strong>
              <br />
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  wordBreak: "break-all",
                }}
              >
                {account.address}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
