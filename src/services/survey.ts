import type {
  CreateSurveyRequest,
  Survey,
  UpdateSurveyRequest,
} from "@/types/survey";
import type { SurveyFraudAnalysisResult } from "@/types/assignment";
import { API_BASE_URL, requestJson } from "@/lib/http-client";

export async function fetchSurveys(): Promise<Survey[]> {
  return requestJson<Survey[]>(`${API_BASE_URL}/surveys`);
}

export async function fetchSurveyByPeriodId(
  surveyPeriodId: string,
): Promise<Survey> {
  return requestJson<Survey>(`${API_BASE_URL}/surveys/${surveyPeriodId}`);
}

export async function createSurvey(
  payload: CreateSurveyRequest,
): Promise<void> {
  await requestJson<null>(`${API_BASE_URL}/surveys`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSurvey(
  surveyPeriodId: string,
  payload: UpdateSurveyRequest,
): Promise<void> {
  await requestJson<null>(`${API_BASE_URL}/surveys/${surveyPeriodId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function syncSurveyAssignments(
  surveyPeriodId: string,
): Promise<void> {
  await requestJson<null>(`${API_BASE_URL}/surveys/${surveyPeriodId}/sync`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function analyzeSurveyAssignments(
  surveyPeriodId: string,
): Promise<SurveyFraudAnalysisResult> {
  return requestJson<SurveyFraudAnalysisResult>(
    `${API_BASE_URL}/surveys/${surveyPeriodId}/analyze`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}