import type { ApiError } from "./apiTypes";

const TOKEN_KEY = "dtplus.accessToken";

export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ApiError | null;
    throw new ApiClientError(response.status, payload?.error.code ?? "REQUEST_FAILED", payload?.error.message ?? `Request failed with status ${response.status}.`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function downloadApiFile(path: string, filename: string) {
  const token = getAccessToken();
  const response = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ApiError | null;
    throw new ApiClientError(response.status, payload?.error.code ?? "DOWNLOAD_FAILED", payload?.error.message ?? "Download failed.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchApiFile(path: string) {
  const token = getAccessToken();
  const response = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ApiError | null;
    throw new ApiClientError(response.status, payload?.error.code ?? "FILE_REQUEST_FAILED", payload?.error.message ?? "The file could not be loaded.");
  }
  return { blob: await response.blob(), contentType: response.headers.get("content-type") ?? "application/octet-stream" };
}
