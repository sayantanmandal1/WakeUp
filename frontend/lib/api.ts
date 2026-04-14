const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// SECURITY_NOTE: Token is stored in localStorage and sent via Bearer header.
// All API calls validate the token on the backend.

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wakeup_token");
}

export function setToken(token: string) {
  localStorage.setItem("wakeup_token", token);
}

export function clearToken() {
  localStorage.removeItem("wakeup_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    throw new Error("Unauthorized");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}

export interface LoginResponse {
  token: string;
  username: string;
}

export interface Website {
  id: number;
  url: string;
  status: string;
}

export function login(username: string, password: string) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getWebsites() {
  return request<Website[]>("/api/websites");
}

export function addWebsite(url: string) {
  return request<Website>("/api/websites", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function deleteWebsite(id: number) {
  return request<{ message: string }>(`/api/websites/${id}`, {
    method: "DELETE",
  });
}

export function toggleWebsite(id: number) {
  return request<{ id: number; status: string }>(
    `/api/websites/${id}/toggle`,
    { method: "PATCH" }
  );
}
