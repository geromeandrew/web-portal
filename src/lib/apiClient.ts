import type { ApiError } from "./apiTypes";

export type AccessTokenProvider = {
  get(): Promise<string | null>;
  renew(): Promise<string | null>;
};

const unauthenticatedTokenProvider: AccessTokenProvider = {
  get: async () => null,
  renew: async () => null,
};

let tokenProvider = unauthenticatedTokenProvider;

export function setAccessTokenProviderForTests(
  provider: AccessTokenProvider | null,
) {
  tokenProvider = provider ?? unauthenticatedTokenProvider;
}

export function configureAccessTokenProvider(provider: AccessTokenProvider) {
  tokenProvider = provider;
}

export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function getAuthorizedToken() {
  const token = await tokenProvider.get();
  if (!token) {
    throw new ApiClientError(401, "UNAUTHENTICATED", "Sign in is required.");
  }
  return token;
}

export async function renewAccessToken() {
  const token = await tokenProvider.renew();
  if (!token) {
    throw new ApiClientError(
      401,
      "UNAUTHENTICATED",
      "Your Okta session has expired. Please sign in again.",
    );
  }
  return token;
}

async function authorizedFetch(
  path: string,
  options: RequestInit = {},
  retried = false,
  tokenOverride?: string,
) {
  const headers = new Headers(options.headers);
  headers.set(
    "Authorization",
    `Bearer ${tokenOverride ?? (await getAuthorizedToken())}`,
  );
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: options.credentials ?? "same-origin",
  });
  if (response.status === 401 && !retried) {
    const renewedToken = await renewAccessToken();
    return authorizedFetch(path, options, true, renewedToken);
  }
  return response;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await authorizedFetch(path, options);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiClientError(
      response.status,
      payload?.error.code ?? "REQUEST_FAILED",
      payload?.error.message ?? `Request failed with status ${response.status}.`,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function downloadApiFile(path: string, filename: string) {
  const response = await authorizedFetch(path);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiClientError(
      response.status,
      payload?.error.code ?? "DOWNLOAD_FAILED",
      payload?.error.message ?? "Download failed.",
    );
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
    const payload = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiClientError(
      response.status,
      payload?.error.code ?? "FILE_REQUEST_FAILED",
      payload?.error.message ?? "The file could not be loaded.",
    );
  }
  return {
    blob: await response.blob(),
    contentType:
      response.headers.get("content-type") ?? "application/octet-stream",
  };
}
