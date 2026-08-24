const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  signerAddress: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  roles: string[];
  signerAddress: string | null;
  createdAt: string;
}

export interface DiscoveredPermissionKey {
  address: string;
  weight: number;
}

export interface DiscoveredPermission {
  id: number;
  name: string;
  threshold: number;
  keys: DiscoveredPermissionKey[];
  operations: string[];
  allowsTriggerSmartContract: boolean;
}

export interface TreasuryConfigResponse {
  configured: boolean;
  configValid: boolean;
  validationErrors: string[];
  lastValidatedAt: string | null;
  config: {
    treasuryAddress: string;
    activePermissionId: number;
    activePermissionName: string;
    threshold: number;
    signers: Array<{
      role: "signer_a" | "signer_b" | "signer_c";
      label: string;
      address: string;
      weight: number;
    }>;
    network: string;
    usdtContractAddress: string;
  } | null;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      Array.isArray(body.details) && body.details.length > 0
        ? `: ${body.details.join("; ")}`
        : "";
    throw new Error((body.error ?? `Request failed (${response.status})`) + detail);
  }
  return body as T;
}

export const api = {
  login(email: string, password: string) {
    return apiFetch<{ token: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  me() {
    return apiFetch<AuthUser>("/api/me");
  },
  publicConfig() {
    return apiFetch<Record<string, unknown>>("/api/config/public");
  },
  listAdminUsers() {
    return apiFetch<{ users: AdminUser[] }>("/api/admin/users");
  },
  createAdminUser(input: {
    email: string;
    password: string;
    roles: string[];
    signerAddress?: string | null;
  }) {
    return apiFetch<AdminUser>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateAdminUser(
    id: string,
    input: { roles?: string[]; signerAddress?: string | null },
  ) {
    return apiFetch<AdminUser>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  disableAdminUser(id: string) {
    return apiFetch<{ ok: boolean }>(`/api/admin/users/${id}`, {
      method: "DELETE",
    });
  },
  resetAdminUserPassword(id: string, password: string) {
    return apiFetch<{ ok: boolean }>(`/api/admin/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },
  adminTreasuryConfig() {
    return apiFetch<TreasuryConfigResponse>("/api/admin/treasury-config");
  },
  discoverTreasury(address: string) {
    return apiFetch<{
      treasuryAddress: string;
      treasuryExists: boolean;
      activePermissions: DiscoveredPermission[];
    }>(
      `/api/admin/treasury-config/discover?address=${encodeURIComponent(address)}`,
    );
  },
  saveTreasuryConfig(input: {
    treasuryAddress: string;
    activePermissionId: number;
    signers: Array<{
      role: "signer_a" | "signer_b" | "signer_c";
      label: string;
      address: string;
    }>;
  }) {
    return apiFetch<{
      configured: boolean;
      configValid: boolean;
      validationErrors: string[];
      warnings: string[];
      config: {
        treasuryAddress: string;
        activePermissionId: number;
        activePermissionName: string;
        threshold: number;
        signers: Array<{
          role: "signer_a" | "signer_b" | "signer_c";
          label: string;
          address: string;
          weight: number;
        }>;
      };
    }>("/api/admin/treasury-config", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  validateTreasuryConfig() {
    return apiFetch<{
      configured: boolean;
      validation: Record<string, unknown>;
    }>("/api/admin/treasury-config/validate", { method: "POST" });
  },
  treasuryHealth() {
    return apiFetch<Record<string, unknown>>("/api/treasury/health");
  },
  treasuryBalances() {
    return apiFetch<Record<string, unknown>>("/api/treasury/balances");
  },
  listPaymentRequests() {
    return apiFetch<Array<Record<string, unknown>>>("/api/payment-requests");
  },
  getPaymentRequest(id: string) {
    return apiFetch<Record<string, unknown>>(`/api/payment-requests/${id}`);
  },
  createPaymentRequest(input: {
    recipientAddress: string;
    amountDisplay: string;
    purpose: string;
    externalReference: string;
    documentUrl?: string;
    expirationMinutes?: number;
  }) {
    return apiFetch<Record<string, unknown>>("/api/payment-requests", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  cancelPaymentRequest(id: string) {
    return apiFetch<Record<string, unknown>>(`/api/payment-requests/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  createSigningSession(id: string) {
    return apiFetch<{
      signingToken: string;
      signerClientUrl: string;
      expiresAt: string;
    }>(`/api/payment-requests/${id}/signing-session`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  getSignWeight(id: string) {
    return apiFetch<Record<string, unknown>>(`/api/payment-requests/${id}/sign-weight`);
  },
  broadcast(id: string) {
    return apiFetch<Record<string, unknown>>(`/api/payment-requests/${id}/broadcast`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  auditEvents(paymentRequestId?: string) {
    const query = paymentRequestId
      ? `?paymentRequestId=${encodeURIComponent(paymentRequestId)}`
      : "";
    return apiFetch<Array<Record<string, unknown>>>(`/api/audit-events${query}`);
  },
};

export function copyToClipboard(value: string) {
  void navigator.clipboard.writeText(value);
}

export function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}
