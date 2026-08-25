import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LedgerAccountPicker } from "../components/LedgerAccountPicker";
import {
  listLedgerAccounts,
  pickPreferredAccount,
  setStoredDerivationPath,
  signPersonalMessage,
  type LedgerAccount,
} from "../ledger/tron-webhid";

export function LoginPage() {
  const { login, loginWithLedger, user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("email")), String(form.get("password")));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onDiscoverAccounts() {
    setError(null);
    setLedgerBusy(true);
    try {
      const listed = await listLedgerAccounts();
      const preferred = pickPreferredAccount(listed, null);
      setAccounts(listed);
      setSelectedPath(preferred?.derivationPath ?? null);
    } catch (err) {
      setAccounts([]);
      setSelectedPath(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLedgerBusy(false);
    }
  }

  async function onConfirmLedgerLogin() {
    if (!selectedPath) return;
    setError(null);
    setLedgerBusy(true);
    try {
      setStoredDerivationPath(selectedPath);
      await loginWithLedger(async (message) => {
        const signed = await signPersonalMessage(message, selectedPath);
        return { signature: signed.signature, address: signed.address };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLedgerBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 360,
          display: "grid",
          gap: "0.75rem",
          border: "1px solid #ddd",
          padding: "1.5rem",
          borderRadius: 8,
        }}
      >
        <h1>TRON Payments</h1>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
          <label>
            Email
            <input name="email" type="email" required style={{ width: "100%" }} />
          </label>
          <label>
            Password
            <input name="password" type="password" required style={{ width: "100%" }} />
          </label>
          <button type="submit">Sign in</button>
        </form>
        <div style={{ textAlign: "center", color: "#888" }}>or</div>
        {accounts.length === 0 ? (
          <button type="button" onClick={onDiscoverAccounts} disabled={ledgerBusy}>
            {ledgerBusy ? "Waiting for Ledger…" : "Sign in with Ledger"}
          </button>
        ) : (
          <>
            <LedgerAccountPicker
              accounts={accounts}
              selectedPath={selectedPath ?? accounts[0]?.derivationPath ?? ""}
              onSelect={(account) => setSelectedPath(account.derivationPath)}
              name="login-ledger-account"
            />
            <button
              type="button"
              onClick={onConfirmLedgerLogin}
              disabled={ledgerBusy || !selectedPath}
            >
              {ledgerBusy ? "Waiting for Ledger…" : "Continue with selected account"}
            </button>
            <button
              type="button"
              onClick={onDiscoverAccounts}
              disabled={ledgerBusy}
            >
              Rescan Ledger
            </button>
          </>
        )}
        <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
          Unlock the Ledger and open the Tron app first. First Ledger login creates
          an account. An admin must grant the Signer role and add your address to
          treasury settings before you can sign payments.
        </p>
      </div>
    </div>
  );
}
