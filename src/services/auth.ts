import type { AccessTokenResponse, LoginSSORequest } from "@/types/auth";
import {
  API_BASE_URL,
  clearCurrentAccessToken,
  getCurrentAccessToken,
  requestJson,
  setCurrentAccessToken,
} from "@/lib/http-client";

export function getAccessToken(): string | null {
  return getCurrentAccessToken();
}

export function hasAccessToken(): boolean {
  const token = getAccessToken();
  return Boolean(token && token.trim() !== "");
}

export function setAccessToken(token: string): void {
  setCurrentAccessToken(token);
}

export function clearAuthSession(): void {
  clearCurrentAccessToken();
}

export function startSSOLogin(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.location.assign(`${API_BASE_URL}/auth/sso`);
}

export async function loginWithSSO(payload: LoginSSORequest): Promise<string> {
  await requestJson<AccessTokenResponse>(`${API_BASE_URL}/auth/sso`, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
    skipAuthRefresh: true,
  });

  return refreshAccessToken();
}

export async function refreshAccessToken(): Promise<string> {
  const data = await requestJson<AccessTokenResponse>(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    skipAuthRefresh: true,
  });

  setAccessToken(data.access_token);
  return data.access_token;
}

export async function logout(): Promise<void> {
  await requestJson<null>(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    skipAuthRefresh: true,
  });

  clearAuthSession();
}