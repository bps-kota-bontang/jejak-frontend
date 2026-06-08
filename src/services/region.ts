import type { AssignmentLogPoint } from "@/types/assignment";
import type { SurveyRegion } from "@/types/region";
import { API_BASE_URL, requestJson } from "@/lib/http-client";

export type SurveyRegionFilter = {
  region_full_code?: string;
  region_level_1?: string;
  region_level_2?: string;
  region_level_3?: string;
  region_level_4?: string;
  region_level_5?: string;
  region_level_6?: string;
};

export type SurveyRegionLogsFilter = {
  region_full_code: string;
  actioned_at_from?: string;
  actioned_at_to?: string;
};

export async function fetchSurveyRegions(
  surveyPeriodId: string,
  filter?: SurveyRegionFilter,
): Promise<SurveyRegion[]> {
  const params = new URLSearchParams();

  if (filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (value && value.trim() !== "") {
        params.set(key, value);
      }
    }
  }

  const query = params.toString();

  return requestJson<SurveyRegion[]>(
    `${API_BASE_URL}/surveys/${surveyPeriodId}/regions${query ? `?${query}` : ""}`,
  );
}

export async function syncSurveyRegions(
  surveyPeriodId: string,
): Promise<void> {
  await requestJson<null>(`${API_BASE_URL}/surveys/${surveyPeriodId}/regions/sync`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchSurveyRegionLogs(
  surveyPeriodId: string,
  filter: SurveyRegionLogsFilter,
): Promise<AssignmentLogPoint[]> {
  const params = new URLSearchParams();
  params.set("region_full_code", filter.region_full_code);

  if (filter.actioned_at_from && filter.actioned_at_from.trim() !== "") {
    params.set("actioned_at_from", filter.actioned_at_from);
  }

  if (filter.actioned_at_to && filter.actioned_at_to.trim() !== "") {
    params.set("actioned_at_to", filter.actioned_at_to);
  }

  return requestJson<AssignmentLogPoint[]>(
    `${API_BASE_URL}/surveys/${surveyPeriodId}/logs?${params.toString()}`,
  );
}