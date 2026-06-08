import { API_BASE_URL, requestJson } from "@/lib/http-client";
import type { CreateUserRequest, UpdateUserRequest, UserResponse } from "@/types/user";

export async function fetchCurrentUser(): Promise<UserResponse> {
  return requestJson<UserResponse>(`${API_BASE_URL}/users/me`);
}

export async function fetchUsers(): Promise<UserResponse[]> {
  return requestJson<UserResponse[]>(`${API_BASE_URL}/users?per_page=100`);
}

export async function createUser(payload: CreateUserRequest): Promise<void> {
  await requestJson<null>(`${API_BASE_URL}/users`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(userId: string, payload: UpdateUserRequest): Promise<void> {
  await requestJson<null>(`${API_BASE_URL}/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}