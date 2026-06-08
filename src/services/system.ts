import { API_BASE_URL, requestJson } from "@/lib/http-client";
import type { SystemFeaturesResponse } from "@/types/system";

export async function fetchSystemFeatures(): Promise<SystemFeaturesResponse> {
  return requestJson<SystemFeaturesResponse>(`${API_BASE_URL}/system/features`);
}