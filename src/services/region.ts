import type { AssignmentLogPoint } from "@/types/assignment";
import type { ApiEnvelope } from "@/types/api";
import type { SurveyRegion } from "@/types/region";
import { API_BASE_URL, requestJson, requestWithAuth } from "@/lib/http-client";

export type SurveyRegionFilter = {
  region_full_code?: string;
  region_level_1?: string;
  region_level_2?: string;
  region_level_3?: string;
  region_level_4?: string;
  region_level_5?: string;
  region_level_6?: string;
  assignment_filter?: "has" | "none";
};

export type SurveyRegionPagination = {
  page: number;
  per_page: number;
};

export type SurveyRegionPageMeta = {
  total: number;
  pages: number;
  page: number;
  per_page: number;
};

export type SurveyRegionsPageResult = {
  items: SurveyRegion[];
  meta: SurveyRegionPageMeta;
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

export async function fetchSurveyRegionsPage(
  surveyPeriodId: string,
  filter: SurveyRegionFilter,
  pagination: SurveyRegionPagination,
): Promise<SurveyRegionsPageResult> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filter)) {
    if (value && value.trim() !== "") {
      params.set(key, value);
    }
  }

  params.set("page", String(pagination.page));
  params.set("per_page", String(pagination.per_page));

  const response = await requestWithAuth(
    `${API_BASE_URL}/surveys/${surveyPeriodId}/regions?${params.toString()}`,
  );
  const payload = (await response.json()) as ApiEnvelope<SurveyRegion[]>;

  if (!response.ok) {
    const message = payload.message || "Request failed";
    const details = payload.errors?.join(", ") || "";
    throw new Error(details ? `${message}: ${details}` : message);
  }

  const metaRaw = (payload.meta || {}) as Partial<SurveyRegionPageMeta>;
  return {
    items: payload.data || [],
    meta: {
      total: Number(metaRaw.total || 0),
      pages: Number(metaRaw.pages || 1),
      page: Number(metaRaw.page || pagination.page),
      per_page: Number(metaRaw.per_page || pagination.per_page),
    },
  };
}

export type RegionFilterRequest = {
  level1?: string;
  level2?: string;
  level3?: string;
  level4?: string;
  level5?: string;
};

export type RegionFilterOption = {
  value: string;
  label: string;
};

export type RegionFilterOptionsResponse = {
  level_1: RegionFilterOption[];
  level_2: RegionFilterOption[];
  level_3: RegionFilterOption[];
  level_4: RegionFilterOption[];
  level_5: RegionFilterOption[];
  level_6: RegionFilterOption[];
};

export async function fetchSurveyRegionFilterOptions(
  surveyPeriodId: string,
  filters?: RegionFilterRequest,
): Promise<RegionFilterOptionsResponse> {
  const params = new URLSearchParams();
  if (filters?.level1) params.append("level1", filters.level1);
  if (filters?.level2) params.append("level2", filters.level2);
  if (filters?.level3) params.append("level3", filters.level3);
  if (filters?.level4) params.append("level4", filters.level4);
  if (filters?.level5) params.append("level5", filters.level5);

  const queryString = params.toString();
  const url =
    queryString.length > 0
      ? `${API_BASE_URL}/surveys/${surveyPeriodId}/regions/filter-options?${queryString}`
      : `${API_BASE_URL}/surveys/${surveyPeriodId}/regions/filter-options`;

  const response = await requestWithAuth(url);
  const payload = (await response.json()) as ApiEnvelope<RegionFilterOptionsResponse>;

  if (!response.ok) {
    const message = payload.message || "Request failed";
    const details = payload.errors?.join(", ") || "";
    throw new Error(details ? `${message}: ${details}` : message);
  }

  return payload.data || {
    level_1: [],
    level_2: [],
    level_3: [],
    level_4: [],
    level_5: [],
    level_6: [],
  };
}

export async function syncSurveyRegions(surveyPeriodId: string): Promise<void> {
  await requestJson<null>(
    `${API_BASE_URL}/surveys/${surveyPeriodId}/regions/sync`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function importSurveyRegions(
  surveyPeriodId: string,
  file: File,
): Promise<void> {
  const formData = new FormData();
  formData.set("file", file);

  await requestJson<null>(
    `${API_BASE_URL}/surveys/${surveyPeriodId}/regions/import`,
    {
      method: "POST",
      body: formData,
    },
  );
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
