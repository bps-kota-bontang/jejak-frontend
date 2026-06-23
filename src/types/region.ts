export type SurveyRegion = {
  id: string;
  survey_id: string;
  survey_period_id: string;
  region_group_id: string;
  assignment_count: number;
  draft_count: number;
  submitted_count: number;
  approved_count: number;
  rejected_count: number;
  revoked_count: number;
  level_1?: string;
  level_2?: string;
  level_3?: string;
  level_4?: string;
  level_5?: string;
  level_6?: string;
  level_1_label?: string;
  level_2_label?: string;
  level_3_label?: string;
  level_4_label?: string;
  level_5_label?: string;
  level_6_label?: string;
  pj?: string;
  pml?: string;
  ppl?: string;
  full_code: string;
};

export type SurveyRegionMetadataLevel = {
  id: string;
  name: string;
};

export type SurveyRegionMetadata = {
  region_group_id: string;
  level_count: number;
  smallest_region_level: number;
  group_name: string;
  is_active: boolean;
  is_public: boolean;
  level: SurveyRegionMetadataLevel[];
};
