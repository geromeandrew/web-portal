import type { ApiError, UserDto } from "./apiTypes";

const TOKEN_KEY = "dtplus.accessToken";
type AuthenticationResponse = { accessToken: string; user: UserDto };

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

let refreshInFlight: Promise<AuthenticationResponse> | null = null;

export function refreshAccessToken(): Promise<AuthenticationResponse> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ApiError | null;
          throw new ApiClientError(response.status, payload?.error.code ?? "SESSION_REFRESH_FAILED", payload?.error.message ?? "Your session has expired. Please sign in again.");
        }
        return response.json() as Promise<AuthenticationResponse>;
      })
      .then((authentication) => {
        setAccessToken(authentication.accessToken);
        return authentication;
      })
      .catch((error) => {
        setAccessToken(null);
        throw error;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function getAuthorizedToken() {
  return getAccessToken() ?? (await refreshAccessToken()).accessToken;
}

async function authorizedFetch(path: string, options: RequestInit = {}, retried = false) {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: options.credentials ?? "same-origin",
  });
  if (response.status === 401 && !retried && !path.startsWith("/auth/")) {
    await refreshAccessToken();
    return authorizedFetch(path, options, true);
  }
  return response;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authorizedFetch(path, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ApiError | null;
    throw new ApiClientError(response.status, payload?.error.code ?? "REQUEST_FAILED", payload?.error.message ?? `Request failed with status ${response.status}.`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function downloadApiFile(path: string, filename: string) {
  const response = await authorizedFetch(path);
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
  const response = await authorizedFetch(path);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ApiError | null;
    throw new ApiClientError(response.status, payload?.error.code ?? "FILE_REQUEST_FAILED", payload?.error.message ?? "The file could not be loaded.");
  }
  return { blob: await response.blob(), contentType: response.headers.get("content-type") ?? "application/octet-stream" };
}
