export type LocationAnswerStat = {
  canonical_id: string;
  latitude: number;
  longitude: number;
  answer_count: number;
  proportion: number;
  distance_to_sample_meters: number;
  within_sample_area_radius: boolean;
};

export type Assignment = {
  id: string;
  survey_period_id: string;
  assignment_id: string;
  region_full_code?: string;
  region_level_1?: string;
  region_level_2?: string;
  region_level_3?: string;
  region_level_4?: string;
  region_level_5?: string;
  region_level_6?: string;
  latitude: number;
  longitude: number;
  started_at?: string;
  opened_at?: string;
  submitted_at: string;
  revised_at: string;
  is_violation: boolean;
  violation_note?: string;
  violation_score?: number;
  locations?: LocationAnswerStat[];
  created_at: string;
  updated_at: string;
};

export type AssignmentLogPoint = {
  id: string;
  assignment_id: string;
  action: string;
  latitude: number;
  longitude: number;
  actioned_at: string;
};

export type AssignmentAnalysisResponse = {
  assignment_id: string;
  survey_period_id: string;
  total_answers: number;
  locations: LocationAnswerStat[];
  outside_area_proportion: number;
  is_violation: boolean;
  violation_score?: number;
};

export type SurveyFraudAnalysisResult = {
  survey_period_id: string;
  total_assignments: number;
  analyzed_assignments: number;
  generated_at: string;
  assignments: AssignmentAnalysisResponse[];
};