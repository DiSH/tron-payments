import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <form
        onSubmit={onSubmit}
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
    </div>
  );
}
