import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Layout() {
  const { user, logout, hasRole } = useAuth();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          gap: "1rem",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid #ddd",
          alignItems: "center",
        }}
      >
        <strong>TRON Payments</strong>
        <nav style={{ display: "flex", gap: "1rem", flex: 1 }}>
          <Link to="/">Dashboard</Link>
          <Link to="/requests/new">New request</Link>
          <Link to="/signing-queue">Signing queue</Link>
          <Link to="/treasury">Treasury</Link>
          {hasRole("admin") && <Link to="/admin/users">Users</Link>}
          {hasRole("admin") && <Link to="/admin/treasury">Treasury settings</Link>}
          <Link to="/audit">Audit</Link>
        </nav>
        <span style={{ color: "#666" }}>{user?.email}</span>
        <button type="button" onClick={logout}>
          Logout
        </button>
      </header>
      <main style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}
