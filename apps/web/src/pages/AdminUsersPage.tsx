import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, displayUserLabel, type AdminUser } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const ROLES = [
  "requester",
  "signer",
  "executor",
  "admin",
  "auditor",
] as const;

type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  requester: "Requester",
  signer: "Signer",
  executor: "Executor",
  admin: "Admin",
  auditor: "Auditor",
};

function RoleCheckboxes({
  selected,
  onChange,
  idPrefix,
}: {
  selected: string[];
  onChange: (roles: string[]) => void;
  idPrefix: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem" }}>
      {ROLES.map((role) => {
        const checked = selected.includes(role);
        return (
          <label key={role} htmlFor={`${idPrefix}-${role}`} style={{ fontSize: 14 }}>
            <input
              id={`${idPrefix}-${role}`}
              type="checkbox"
              checked={checked}
              onChange={() => {
                onChange(
                  checked
                    ? selected.filter((item) => item !== role)
                    : [...selected, role],
                );
              }}
            />{" "}
            {ROLE_LABELS[role]}
          </label>
        );
      })}
    </div>
  );
}

export function AdminUsersPage() {
  const { user: currentUser, hasRole } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createRoles, setCreateRoles] = useState<string[]>(["requester"]);
  const [createSigner, setCreateSigner] = useState("");
  const [creating, setCreating] = useState(false);

  const [editRoles, setEditRoles] = useState<Record<string, string[]>>({});
  const [editSigner, setEditSigner] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [resetForId, setResetForId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  function flash(message: string) {
    setSuccess(message);
    setError(null);
  }

  async function loadUsers() {
    const result = await api.listAdminUsers();
    setUsers(result.users);
    const roles: Record<string, string[]> = {};
    const signers: Record<string, string> = {};
    for (const item of result.users) {
      roles[item.id] = [...item.roles];
      signers[item.id] = item.signerAddress ?? "";
    }
    setEditRoles(roles);
    setEditSigner(signers);
  }

  useEffect(() => {
    api
      .listAdminUsers()
      .then((result) => {
        setUsers(result.users);
        const roles: Record<string, string[]> = {};
        const signers: Record<string, string> = {};
        for (const item of result.users) {
          roles[item.id] = [...item.roles];
          signers[item.id] = item.signerAddress ?? "";
        }
        setEditRoles(roles);
        setEditSigner(signers);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (!hasRole("admin")) {
    return <Navigate to="/" replace />;
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      await api.createAdminUser({
        email,
        password,
        roles: createRoles,
        signerAddress: createSigner.trim() || null,
      });
      setEmail("");
      setPassword("");
      setCreateRoles(["requester"]);
      setCreateSigner("");
      await loadUsers();
      flash("User created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function onSave(id: string) {
    setSavingId(id);
    setError(null);
    setSuccess(null);
    try {
      await api.updateAdminUser(id, {
        roles: editRoles[id] ?? [],
        signerAddress: (editSigner[id] ?? "").trim() || null,
      });
      await loadUsers();
      flash("User updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  }

  async function onReset(id: string) {
    if (resetPassword !== resetConfirm) {
      setError("New password and confirmation do not match");
      return;
    }
    setResetting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.resetAdminUserPassword(id, resetPassword);
      setResetForId(null);
      setResetPassword("");
      setResetConfirm("");
      flash("Password reset. Existing sessions for that user are invalidated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
    }
  }

  async function onDelete(user: AdminUser) {
    if (user.id === currentUser?.id) {
      setError("Cannot disable your own account");
      return;
    }
    const confirmed = window.confirm(
      `Disable ${user.email}? They will no longer be able to sign in.`,
    );
    if (!confirmed) return;
    setDeletingId(user.id);
    setError(null);
    setSuccess(null);
    try {
      await api.disableAdminUser(user.id);
      await loadUsers();
      flash(`Disabled ${displayUserLabel(user)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Users</h1>
      <p style={{ color: "#555", maxWidth: 720 }}>
        Provision application accounts, assign RBAC roles, bind a Ledger signer
        address, reset passwords, or disable access. Disabled users stay in the
        audit history and cannot sign in.
      </p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      <section
        style={{
          border: "1px solid #ddd",
          padding: "1rem",
          borderRadius: 8,
          marginBottom: "1.5rem",
          maxWidth: 720,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Add user</h2>
        <form onSubmit={onCreate} style={{ display: "grid", gap: "0.75rem" }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            Initial password (min 10 characters)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
              style={{ width: "100%" }}
            />
          </label>
          <fieldset style={{ border: "1px solid #eee", padding: "0.75rem" }}>
            <legend>Roles</legend>
            <RoleCheckboxes
              idPrefix="create-role"
              selected={createRoles}
              onChange={setCreateRoles}
            />
          </fieldset>
          <label>
            Signer address (optional TRON T… address)
            <input
              value={createSigner}
              onChange={(e) => setCreateSigner(e.target.value)}
              placeholder="T…"
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </label>
          <button type="submit" disabled={creating || createRoles.length === 0}>
            {creating ? "Creating…" : "Create user"}
          </button>
        </form>
      </section>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Email</th>
            <th align="left">Roles</th>
            <th align="left">Signer address</th>
            <th align="left">Created</th>
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((item) => (
            <tr key={item.id} style={{ borderTop: "1px solid #eee", verticalAlign: "top" }}>
              <td style={{ padding: "0.75rem 0.5rem 0.75rem 0" }}>
                {displayUserLabel(item)}
                {!item.email && item.signerAddress ? " (Ledger)" : ""}
                {item.id === currentUser?.id ? (
                  <span style={{ color: "#666", fontSize: 12 }}> (you)</span>
                ) : null}
              </td>
              <td style={{ padding: "0.75rem 0.5rem" }}>
                <RoleCheckboxes
                  idPrefix={`edit-${item.id}`}
                  selected={editRoles[item.id] ?? item.roles}
                  onChange={(roles) =>
                    setEditRoles((prev) => ({ ...prev, [item.id]: roles }))
                  }
                />
              </td>
              <td style={{ padding: "0.75rem 0.5rem" }}>
                <input
                  value={editSigner[item.id] ?? ""}
                  onChange={(e) =>
                    setEditSigner((prev) => ({
                      ...prev,
                      [item.id]: e.target.value,
                    }))
                  }
                  placeholder="T…"
                  style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
                />
              </td>
              <td style={{ padding: "0.75rem 0.5rem", fontSize: 13, color: "#555" }}>
                {new Date(item.createdAt).toLocaleString()}
              </td>
              <td style={{ padding: "0.75rem 0", display: "grid", gap: "0.35rem" }}>
                <button
                  type="button"
                  onClick={() => onSave(item.id)}
                  disabled={savingId === item.id}
                >
                  {savingId === item.id ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetForId(item.id === resetForId ? null : item.id);
                    setResetPassword("");
                    setResetConfirm("");
                    setError(null);
                  }}
                >
                  Reset password
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  disabled={deletingId === item.id || item.id === currentUser?.id}
                >
                  {deletingId === item.id ? "Disabling…" : "Delete"}
                </button>
                {resetForId === item.id && (
                  <div
                    style={{
                      display: "grid",
                      gap: "0.35rem",
                      marginTop: "0.25rem",
                      padding: "0.5rem",
                      background: "#f7f7f7",
                      borderRadius: 4,
                    }}
                  >
                    <input
                      type="password"
                      placeholder="New password"
                      value={resetPassword}
                      minLength={10}
                      autoComplete="new-password"
                      onChange={(e) => setResetPassword(e.target.value)}
                    />
                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={resetConfirm}
                      minLength={10}
                      autoComplete="new-password"
                      onChange={(e) => setResetConfirm(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={resetting}
                      onClick={() => onReset(item.id)}
                    >
                      {resetting ? "Resetting…" : "Set password"}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: "1rem 0", color: "#666" }}>
                No active users.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
