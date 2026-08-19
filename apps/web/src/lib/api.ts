const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  signerAddress: string | null;
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
    throw new Error(body.error ?? `Request failed (${response.status})`);
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
