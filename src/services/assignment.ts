import type {
  Assignment,
  AssignmentAnalysisResponse,
  AssignmentLogPoint,
} from "@/types/assignment";
import { API_BASE_URL, requestJson } from "@/lib/http-client";

export async function fetchAssignmentsBySurveyPeriodId(
  surveyPeriodId: string,
  filter?: { key: string; value: string },
): Promise<Assignment[]> {
  const params = new URLSearchParams();

  if (filter?.key && filter?.value) {
    params.set(filter.key, filter.value);
  }

  const query = params.toString();
  const url = `${API_BASE_URL}/surveys/${surveyPeriodId}/assignments${query ? `?${query}` : ""}`;

  return requestJson<Assignment[]>(url);
}

export async function analyzeAssignment(
  assignmentId: string,
): Promise<AssignmentAnalysisResponse> {
  return requestJson<AssignmentAnalysisResponse>(
    `${API_BASE_URL}/assignments/${assignmentId}/analyze`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function fetchAssignmentLogs(
  assignmentId: string,
): Promise<AssignmentLogPoint[]> {
  return requestJson<AssignmentLogPoint[]>(`${API_BASE_URL}/assignments/${assignmentId}/logs`);
}