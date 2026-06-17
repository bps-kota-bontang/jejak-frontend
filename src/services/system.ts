import { API_BASE_URL, requestJson } from "@/lib/http-client";
import type {
  SystemFasihAuthorizationResponse,
  SystemFeaturesResponse,
} from "@/types/system";

export async function fetchSystemFeatures(): Promise<SystemFeaturesResponse> {
  return requestJson<SystemFeaturesResponse>(`${API_BASE_URL}/system/features`);
}

export async function fetchSystemFasihAuthorization(
  surveyPeriodID: string,
): Promise<SystemFasihAuthorizationResponse> {
  const periodID = surveyPeriodID.trim();
  if (!periodID) {
    throw new Error("survey_period_id wajib diisi");
  }

  const url = `${API_BASE_URL}/system/features/fasih-authorization?survey_period_id=${encodeURIComponent(periodID)}`;
  return requestJson<SystemFasihAuthorizationResponse>(url);
}