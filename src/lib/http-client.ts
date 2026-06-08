import type { ApiEnvelope } from "@/types/api";

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();

if (!rawApiBaseUrl) {
  throw new Error("VITE_API_BASE_URL belum diset");
}

const normalizedApiOrigin = rawApiBaseUrl.replace(/\/+$/, "");
export const API_ORIGIN = new URL(normalizedApiOrigin).origin;
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
export const AUTH_EVENT_UNAUTHORIZED = "auth:unauthorized";
let currentAccessToken: string | null = null;

type RequestJsonInit = RequestInit & {
  skipAuthRefresh?: boolean;
};

type RequestWithAuthInit = RequestInit & {
  skipAuthRefresh?: boolean;
};

export function getCurrentAccessToken(): string | null {
  return currentAccessToken;
}

export function setCurrentAccessToken(token: string): void {
  currentAccessToken = token;
}

export function clearCurrentAccessToken(): void {
  currentAccessToken = null;
}

function emitUnauthorizedEvent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_EVENT_UNAUTHORIZED));
}

function buildHeaders(
  init?: RequestInit,
  accessToken?: string | null,
): HeadersInit {
  const headers = new Headers(init?.headers);
  const hasExplicitContentType = headers.has("Content-Type");
  const isFormDataBody =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  return {
    ...(!hasExplicitContentType && !isFormDataBody
      ? { "Content-Type": "application/json" }
      : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(init?.headers || {}),
  };
}

async function tryRefreshAccessToken(): Promise<string | null> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    clearCurrentAccessToken();
    emitUnauthorizedEvent();
    return null;
  }

  const payload = (await response.json()) as ApiEnvelope<{
    access_token: string;
  }>;
  const accessToken = payload.data?.access_token;

  if (!accessToken || accessToken.trim() === "") {
    clearCurrentAccessToken();
    emitUnauthorizedEvent();
    return null;
  }

  setCurrentAccessToken(accessToken);
  return accessToken;
}

export async function requestJson<T>(
  url: string,
  init?: RequestJsonInit,
): Promise<T> {
  const { skipAuthRefresh, ...requestInit } = init || {};
  const accessToken = getCurrentAccessToken();

  const response = await fetch(url, {
    ...requestInit,
    headers: buildHeaders(requestInit, accessToken),
  });

  const isRefreshEndpoint = url.endsWith("/auth/refresh");

  if (response.status === 401 && !skipAuthRefresh && !isRefreshEndpoint) {
    const refreshedToken = await tryRefreshAccessToken();
    if (refreshedToken) {
      const retriedResponse = await fetch(url, {
        ...requestInit,
        headers: buildHeaders(requestInit, refreshedToken),
      });

      const retriedPayload = (await retriedResponse.json()) as ApiEnvelope<T>;
      if (!retriedResponse.ok) {
        const message = retriedPayload.message || "Request failed";
        const details = retriedPayload.errors?.join(", ") || "";
        throw new Error(details ? `${message}: ${details}` : message);
      }

      return retriedPayload.data;
    }

    emitUnauthorizedEvent();
  }

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok) {
    const message = payload.message || "Request failed";
    const details = payload.errors?.join(", ") || "";
    throw new Error(details ? `${message}: ${details}` : message);
  }

  return payload.data;
}

export async function requestWithAuth(
  url: string,
  init?: RequestWithAuthInit,
): Promise<Response> {
  const { skipAuthRefresh, ...requestInit } = init || {};
  const accessToken = getCurrentAccessToken();

  const response = await fetch(url, {
    ...requestInit,
    headers: buildHeaders(requestInit, accessToken),
  });

  const isRefreshEndpoint = url.endsWith("/auth/refresh");
  if (response.status === 401 && !skipAuthRefresh && !isRefreshEndpoint) {
    const refreshedToken = await tryRefreshAccessToken();
    if (refreshedToken) {
      return fetch(url, {
        ...requestInit,
        headers: buildHeaders(requestInit, refreshedToken),
      });
    }

    emitUnauthorizedEvent();
  }

  return response;
}
