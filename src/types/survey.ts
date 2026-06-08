import type { Area } from "@/types/area";

export type Survey = {
  id: string;
  name: string;
  survey_id: string;
  survey_period_id: string;
  xsrf_token: string;
  cookie: string;
  region_level_1?: string;
  region_level_2?: string;
  log_delta_max_minutes?: number;
  log_date_from?: string;
  log_date_to?: string;
  area_id?: string;
  geojson_key?: string;
  area?: Area;
  created_at: string;
  updated_at: string;
};

export type CreateSurveyRequest = {
  name: string;
  survey_id: string;
  survey_period_id: string;
  xsrf_token: string;
  cookie: string;
  region_level_1: string;
  region_level_2: string;
  log_delta_max_minutes?: number;
  log_date_from?: string;
  log_date_to?: string;
  area_id: string;
  geojson_key: string;
};

export type UpdateSurveyRequest = {
  name: string;
  survey_id: string;
  xsrf_token: string;
  cookie: string;
  region_level_1: string;
  region_level_2: string;
  log_delta_max_minutes?: number;
  log_date_from?: string;
  log_date_to?: string;
  area_id: string;
  geojson_key: string;
};