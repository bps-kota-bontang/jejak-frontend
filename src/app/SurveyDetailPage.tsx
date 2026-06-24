import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  analyzeSurveyAssignments,
  analyzeSurveyAssignmentsByRegion,
  fetchSurveyByPeriodId,
  importSurveyAssignments,
  syncSurveyAssignments,
  syncSurveyAssignmentsByRegion,
  updateSurvey,
} from "@/services/survey";
import {
  downloadSurveyRegionContactsTemplate,
  fetchSurveyRegionFilterOptions,
  fetchSurveyRegionsPage,
  importSurveyRegionContacts,
  importSurveyRegions,
  syncSurveyRegions,
  type RegionFilterOptionsResponse,
} from "@/services/region";
import {
  connectSurveyToExtension,
  importSurveyCredentialsFromBrowser,
} from "@/services/extension";
import {
  fetchSystemFasihAuthorization,
  fetchSystemFeatures,
} from "@/services/system";
import type { SurveyRegion } from "@/types/region";
import type { Survey, UpdateSurveyRequest } from "@/types/survey";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/providers/AuthProvider";
import { Filter } from "lucide-react";

type RegionCodeFilters = {
  kdprov: string;
  kdkab: string;
  kdkec: string;
  kddesa: string;
  kdsls: string;
  kdsubsls: string;
  pj: string;
  pml: string;
  ppl: string;
};

const ALL_FILTER_VALUE = "__all__";
const REGION_PAGE_SIZE_OPTIONS = [10, 50, 100, 1000] as const;
type AssignmentAvailabilityFilter = "all" | "has" | "none";
type RegionStatusFilter =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "revoked";

const REGION_STATUS_FILTER_OPTIONS: {
  value: RegionStatusFilter;
  label: string;
}[] = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "revoked", label: "Revoked" },
];

function parseRegionPageParam(rawValue: string | null): number {
  const value = Number(rawValue || "1");
  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }

  return value;
}

function parseRegionPageSizeParam(rawValue: string | null): number {
  const value = Number(rawValue || String(REGION_PAGE_SIZE_OPTIONS[0]));
  if (!Number.isInteger(value)) {
    return REGION_PAGE_SIZE_OPTIONS[0];
  }

  if (
    REGION_PAGE_SIZE_OPTIONS.includes(
      value as (typeof REGION_PAGE_SIZE_OPTIONS)[number],
    )
  ) {
    return value;
  }

  return REGION_PAGE_SIZE_OPTIONS[0];
}

function parseAssignmentAvailabilityFilter(
  rawValue: string | null,
): AssignmentAvailabilityFilter {
  if (rawValue === "has" || rawValue === "none") {
    return rawValue;
  }

  return "all";
}

function parseRegionStatusFilter(
  rawValue: string | null,
): RegionStatusFilter[] {
  if (!rawValue) {
    return [];
  }

  const allowed = new Set<RegionStatusFilter>(
    REGION_STATUS_FILTER_OPTIONS.map((item) => item.value),
  );
  const selected = new Set<RegionStatusFilter>();
  for (const token of rawValue.split(",")) {
    const value = token.trim().toLowerCase() as RegionStatusFilter;
    if (allowed.has(value)) {
      selected.add(value);
    }
  }

  return REGION_STATUS_FILTER_OPTIONS.map((item) => item.value).filter(
    (value) => selected.has(value),
  );
}

function normalizeRegionCodeFilters(
  filters: RegionCodeFilters,
): RegionCodeFilters {
  const normalized: RegionCodeFilters = {
    kdprov: filters.kdprov.trim(),
    kdkab: filters.kdkab.trim(),
    kdkec: filters.kdkec.trim(),
    kddesa: filters.kddesa.trim(),
    kdsls: filters.kdsls.trim(),
    kdsubsls: filters.kdsubsls.trim(),
    pj: filters.pj.trim(),
    pml: filters.pml.trim(),
    ppl: filters.ppl.trim(),
  };

  if (!normalized.kdprov) {
    normalized.kdkab = "";
  }
  if (!normalized.kdkab) {
    normalized.kdkec = "";
  }
  if (!normalized.kdkec) {
    normalized.kddesa = "";
  }
  if (!normalized.kddesa) {
    normalized.kdsls = "";
  }
  if (!normalized.kdsls) {
    normalized.kdsubsls = "";
  }

  return normalized;
}

function buildRegionFiltersFromSearchParams(
  searchParams: URLSearchParams,
): RegionCodeFilters {
  return normalizeRegionCodeFilters({
    kdprov: searchParams.get("kdprov") || "",
    kdkab: searchParams.get("kdkab") || "",
    kdkec: searchParams.get("kdkec") || "",
    kddesa: searchParams.get("kddesa") || "",
    kdsls: searchParams.get("kdsls") || "",
    kdsubsls: searchParams.get("kdsubsls") || "",
    pj: searchParams.get("pj") || "",
    pml: searchParams.get("pml") || "",
    ppl: searchParams.get("ppl") || "",
  });
}

function buildInitialRegionFilters(survey: Survey | null): RegionCodeFilters {
  const kdprov = survey?.region_level_1 || "";
  const kdkab = survey?.region_level_2 || "";

  return {
    kdprov,
    kdkab,
    kdkec: "",
    kddesa: "",
    kdsls: "",
    kdsubsls: "",
    pj: "",
    pml: "",
    ppl: "",
  };
}

const SurveyDetailPage = () => {
  const { surveyPeriodId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["admin"]);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [regionRows, setRegionRows] = useState<SurveyRegion[]>([]);
  const [regionCodeFilters, setRegionCodeFilters] = useState<RegionCodeFilters>(
    () => buildRegionFiltersFromSearchParams(searchParams),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<
    | "sync-region-backend"
    | "sync-assignment-backend"
    | "sync-assignment-region-backend"
    | "import-region"
    | "import-region-contacts"
    | "download-region-contacts-template"
    | "import-assignment"
    | "connect-survey"
    | null
  >(null);
  const [syncingRegionFullCode, setSyncingRegionFullCode] = useState<
    string | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isAnalyzeLoading, setIsAnalyzeLoading] = useState(false);
  const [analyzingRegionFullCode, setAnalyzingRegionFullCode] = useState<
    string | null
  >(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [updateForm, setUpdateForm] = useState<UpdateSurveyRequest>({
    name: "",
    survey_id: "",
    xsrf_token: "",
    cookie: "",
    region_level_1: "",
    region_level_2: "",
    area_id: "",
    geojson_key: "",
    log_delta_max_minutes: undefined,
    log_date_from: "",
    log_date_to: "",
  });
  const [updateLoading, setUpdateLoading] = useState(false);
  const [importCredentialLoading, setImportCredentialLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [regionPage, setRegionPage] = useState(() =>
    parseRegionPageParam(searchParams.get("page")),
  );
  const [regionPageSize, setRegionPageSize] = useState(() =>
    parseRegionPageSizeParam(searchParams.get("pageSize")),
  );
  const [regionTotal, setRegionTotal] = useState(0);
  const [regionTotalPages, setRegionTotalPages] = useState(1);
  const [assignmentAvailabilityFilter, setAssignmentAvailabilityFilter] =
    useState<AssignmentAvailabilityFilter>(() =>
      parseAssignmentAvailabilityFilter(searchParams.get("assignment")),
    );
  const [regionStatusFilters, setRegionStatusFilters] = useState<
    RegionStatusFilter[]
  >(() => parseRegionStatusFilter(searchParams.get("status")));
  const [backendFasihAvailable, setBackendFasihAvailable] = useState(false);
  const [backendFasihLoading, setBackendFasihLoading] = useState(true);
  const [regionFilterOptions, setRegionFilterOptions] =
    useState<RegionFilterOptionsResponse | null>(null);
  const importRegionInputRef = useRef<HTMLInputElement | null>(null);
  const importRegionContactsInputRef = useRef<HTMLInputElement | null>(null);
  const importAssignmentInputRef = useRef<HTMLInputElement | null>(null);

  const isLevel1Locked = Boolean(survey?.region_level_1);
  const isLevel2Locked = Boolean(survey?.region_level_2);
  const effectiveLevel1Filter =
    survey?.region_level_1 || regionCodeFilters.kdprov;
  const effectiveLevel2Filter =
    survey?.region_level_2 || regionCodeFilters.kdkab;

  const kdprovOptions = useMemo(() => {
    // Use API filter options for level 1
    return regionFilterOptions?.level_1 || [];
  }, [regionFilterOptions?.level_1]);

  const kdprovOptionsWithSurvey = useMemo(() => {
    const surveyLevel1 = survey?.region_level_1?.trim() || "";
    if (!surveyLevel1) {
      return kdprovOptions;
    }

    if (kdprovOptions.some((option) => option.value === surveyLevel1)) {
      return kdprovOptions;
    }

    return [{ value: surveyLevel1, label: surveyLevel1 }, ...kdprovOptions];
  }, [kdprovOptions, survey?.region_level_1]);

  const kdkabOptions = useMemo(() => {
    // Use API filter options for level 2
    return regionFilterOptions?.level_2 || [];
  }, [regionFilterOptions?.level_2]);

  const kdkabOptionsWithSurvey = useMemo(() => {
    const surveyLevel2 = survey?.region_level_2?.trim() || "";
    if (!surveyLevel2) {
      return kdkabOptions;
    }

    if (kdkabOptions.some((option) => option.value === surveyLevel2)) {
      return kdkabOptions;
    }

    return [{ value: surveyLevel2, label: surveyLevel2 }, ...kdkabOptions];
  }, [kdkabOptions, survey?.region_level_2]);

  useEffect(() => {
    let active = true;

    const loadBackendFasihAccess = async () => {
      setBackendFasihLoading(true);
      try {
        const [features, auth] = await Promise.all([
          fetchSystemFeatures(),
          fetchSystemFasihAuthorization(surveyPeriodId),
        ]);
        if (!active) {
          return;
        }
        setBackendFasihAvailable(
          Boolean(features.fasih_available) && Boolean(auth.fasih_authorized),
        );
      } catch {
        if (!active) {
          return;
        }
        setBackendFasihAvailable(false);
      } finally {
        if (active) {
          setBackendFasihLoading(false);
        }
      }
    };

    void loadBackendFasihAccess();

    return () => {
      active = false;
    };
  }, [surveyPeriodId]);

  const kdkecOptions = useMemo(
    () => regionFilterOptions?.level_3 || [],
    [regionFilterOptions?.level_3],
  );

  const kddesaOptions = useMemo(
    () => regionFilterOptions?.level_4 || [],
    [regionFilterOptions?.level_4],
  );

  const kdslsOptions = useMemo(
    () => regionFilterOptions?.level_5 || [],
    [regionFilterOptions?.level_5],
  );

  const kdsubslsOptions = useMemo(
    () => regionFilterOptions?.level_6 || [],
    [regionFilterOptions?.level_6],
  );

  const currentRegionPage = Math.max(1, regionPage);

  const visibleRegionPaginationItems = useMemo<(number | "ellipsis")[]>(() => {
    if (regionTotalPages <= 7) {
      return Array.from({ length: regionTotalPages }, (_, index) => index + 1);
    }

    const items: (number | "ellipsis")[] = [1];
    const start = Math.max(2, currentRegionPage - 1);
    const end = Math.min(regionTotalPages - 1, currentRegionPage + 1);

    if (start > 2) {
      items.push("ellipsis");
    }

    for (let page = start; page <= end; page++) {
      items.push(page);
    }

    if (end < regionTotalPages - 1) {
      items.push("ellipsis");
    }

    items.push(regionTotalPages);
    return items;
  }, [currentRegionPage, regionTotalPages]);

  const paginatedRegions = useMemo(() => regionRows, [regionRows]);
  const selectedStatusCount = regionStatusFilters.length;

  const loadSurvey = useCallback(async () => {
    if (!surveyPeriodId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("[loadSurvey] Starting with surveyPeriodId:", surveyPeriodId);

      const surveyResult = await fetchSurveyByPeriodId(surveyPeriodId);
      console.log("[loadSurvey] Survey loaded:", surveyResult);

      // Note: Filter options are loaded by the cascading filter useEffect below
      // that watches region filter changes

      setSurvey(surveyResult);

      // Initialize region and assignment filters and pagination from URL on first load
      // This will be read from searchParams by the initialization effect
      const normalizedFilters = normalizeRegionCodeFilters({
        kdprov: surveyResult.region_level_1 || "",
        kdkab: surveyResult.region_level_2 || "",
        kdkec: "",
        kddesa: "",
        kdsls: "",
        kdsubsls: "",
        pj: "",
        pml: "",
        ppl: "",
      });

      setRegionCodeFilters(normalizedFilters);
      setUpdateForm({
        name: surveyResult.name,
        survey_id: surveyResult.survey_id,
        xsrf_token: surveyResult.xsrf_token,
        cookie: surveyResult.cookie,
        region_level_1: surveyResult.region_level_1 || "",
        region_level_2: surveyResult.region_level_2 || "",
        area_id: surveyResult.area_id || "",
        geojson_key: surveyResult.geojson_key || "",
        log_delta_max_minutes: surveyResult.log_delta_max_minutes,
        log_date_from: surveyResult.log_date_from || "",
        log_date_to: surveyResult.log_date_to || "",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat detail survey";
      console.error("[loadSurvey] Error:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [surveyPeriodId]);

  useEffect(() => {
    if (!surveyPeriodId) {
      return;
    }

    let active = true;

    const loadRegionPage = async () => {
      try {
        const filter = {
          region_level_1: effectiveLevel1Filter,
          region_level_2: effectiveLevel2Filter,
          region_level_3: regionCodeFilters.kdkec,
          region_level_4: regionCodeFilters.kddesa,
          region_level_5: regionCodeFilters.kdsls,
          region_level_6: regionCodeFilters.kdsubsls,
          pj: regionCodeFilters.pj,
          pml: regionCodeFilters.pml,
          ppl: regionCodeFilters.ppl,
          assignment_filter:
            assignmentAvailabilityFilter === "all"
              ? undefined
              : assignmentAvailabilityFilter,
          status_filter:
            regionStatusFilters.length === 0
              ? undefined
              : regionStatusFilters.join(","),
        };

        const result = await fetchSurveyRegionsPage(surveyPeriodId, filter, {
          page: currentRegionPage,
          per_page: regionPageSize,
        });

        if (!active) {
          return;
        }

        setRegionRows(result.items);
        setRegionTotal(result.meta.total);
        setRegionTotalPages(Math.max(1, result.meta.pages));
        setRegionPage(Math.max(1, result.meta.page));
      } catch {
        if (!active) {
          return;
        }

        setRegionRows([]);
        setRegionTotal(0);
        setRegionTotalPages(1);
      }
    };

    void loadRegionPage();

    return () => {
      active = false;
    };
  }, [
    assignmentAvailabilityFilter,
    regionStatusFilters,
    currentRegionPage,
    effectiveLevel1Filter,
    effectiveLevel2Filter,
    regionCodeFilters.kddesa,
    regionCodeFilters.kdkec,
    regionCodeFilters.kdsls,
    regionCodeFilters.kdsubsls,
    regionCodeFilters.pj,
    regionCodeFilters.pml,
    regionCodeFilters.ppl,
    regionPageSize,
    surveyPeriodId,
  ]);

  useEffect(() => {
    const nextSearchParams = new URLSearchParams(searchParams);
    const activeFilters = normalizeRegionCodeFilters({
      kdprov: effectiveLevel1Filter,
      kdkab: effectiveLevel2Filter,
      kdkec: regionCodeFilters.kdkec,
      kddesa: regionCodeFilters.kddesa,
      kdsls: regionCodeFilters.kdsls,
      kdsubsls: regionCodeFilters.kdsubsls,
      pj: regionCodeFilters.pj,
      pml: regionCodeFilters.pml,
      ppl: regionCodeFilters.ppl,
    });

    const filterEntries: [keyof RegionCodeFilters, string][] = [
      ["kdprov", activeFilters.kdprov],
      ["kdkab", activeFilters.kdkab],
      ["kdkec", activeFilters.kdkec],
      ["kddesa", activeFilters.kddesa],
      ["kdsls", activeFilters.kdsls],
      ["kdsubsls", activeFilters.kdsubsls],
      ["pj", activeFilters.pj],
      ["pml", activeFilters.pml],
      ["ppl", activeFilters.ppl],
    ];

    for (const [key, value] of filterEntries) {
      if (value) {
        nextSearchParams.set(key, value);
      } else {
        nextSearchParams.delete(key);
      }
    }

    if (assignmentAvailabilityFilter === "all") {
      nextSearchParams.delete("assignment");
    } else {
      nextSearchParams.set("assignment", assignmentAvailabilityFilter);
    }

    if (regionStatusFilters.length === 0) {
      nextSearchParams.delete("status");
    } else {
      nextSearchParams.set("status", regionStatusFilters.join(","));
    }

    if (currentRegionPage <= 1) {
      nextSearchParams.delete("page");
    } else {
      nextSearchParams.set("page", String(currentRegionPage));
    }

    if (regionPageSize === REGION_PAGE_SIZE_OPTIONS[0]) {
      nextSearchParams.delete("pageSize");
    } else {
      nextSearchParams.set("pageSize", String(regionPageSize));
    }

    const current = searchParams.toString();
    const next = nextSearchParams.toString();
    if (next !== current) {
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [
    assignmentAvailabilityFilter,
    regionStatusFilters,
    effectiveLevel1Filter,
    effectiveLevel2Filter,
    regionCodeFilters.kddesa,
    regionCodeFilters.kdkec,
    regionCodeFilters.kdsls,
    regionCodeFilters.kdsubsls,
    currentRegionPage,
    regionPageSize,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSurvey();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadSurvey]);

  // Initialize region filters, pagination, and assignment filter from URL on first load
  // This is separate from loadSurvey to avoid refetching survey detail when URL changes
  useEffect(() => {
    if (!survey) {
      return;
    }

    const regionFiltersFromQuery =
      buildRegionFiltersFromSearchParams(searchParams);
    const normalizedFilters = normalizeRegionCodeFilters({
      ...regionFiltersFromQuery,
      kdprov: survey.region_level_1 || regionFiltersFromQuery.kdprov,
      kdkab: survey.region_level_2 || regionFiltersFromQuery.kdkab,
    });

    setRegionCodeFilters(normalizedFilters);
    setRegionPage(parseRegionPageParam(searchParams.get("page")));
    setRegionPageSize(parseRegionPageSizeParam(searchParams.get("pageSize")));
    setAssignmentAvailabilityFilter(
      parseAssignmentAvailabilityFilter(searchParams.get("assignment")),
    );
    setRegionStatusFilters(parseRegionStatusFilter(searchParams.get("status")));
  }, [survey]); // Only run once after survey is loaded

  // Refetch filter options when region filters change for cascading effect
  useEffect(() => {
    // Only fetch after survey is loaded to avoid duplicate requests
    if (!surveyPeriodId || !survey) {
      return;
    }

    let active = true;

    const loadFilterOptions = async () => {
      try {
        console.log(
          "[loadFilterOptions] Loading with filters:",
          effectiveLevel1Filter,
          effectiveLevel2Filter,
          regionCodeFilters.kdkec,
          regionCodeFilters.kddesa,
          regionCodeFilters.kdsls,
        );

        const filterParams = {
          level1: effectiveLevel1Filter || undefined,
          level2: effectiveLevel2Filter || undefined,
          level3: regionCodeFilters.kdkec || undefined,
          level4: regionCodeFilters.kddesa || undefined,
          level5: regionCodeFilters.kdsls || undefined,
        };

        const filterOptions = await fetchSurveyRegionFilterOptions(
          surveyPeriodId,
          filterParams as any,
        );

        if (!active) {
          return;
        }

        console.log(
          "[loadFilterOptions] Filter options refreshed:",
          filterOptions,
        );
        setRegionFilterOptions(filterOptions);
      } catch (err) {
        if (!active) {
          return;
        }
        console.error(
          "[loadFilterOptions] Failed to load filter options:",
          err,
        );
      }
    };

    void loadFilterOptions();

    return () => {
      active = false;
    };
  }, [
    surveyPeriodId,
    survey,
    effectiveLevel1Filter,
    effectiveLevel2Filter,
    regionCodeFilters.kdkec,
    regionCodeFilters.kddesa,
    regionCodeFilters.kdsls,
  ]);

  async function handleSyncRegionBackend() {
    if (!surveyPeriodId) {
      return;
    }

    if (!backendFasihAvailable) {
      setActionError(
        "Sync backend nonaktif: backend belum punya akses ke Fasih.",
      );
      return;
    }

    setActionLoading("sync-region-backend");
    setActionError(null);
    setActionSuccess(null);

    try {
      await syncSurveyRegions(surveyPeriodId);
      setActionSuccess("Sync region berhasil dijalankan.");
      await loadSurvey();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal sync region";
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSyncAssignmentBackend() {
    if (!surveyPeriodId) {
      return;
    }

    if (!backendFasihAvailable) {
      setActionError(
        "Sync backend nonaktif: backend belum punya akses ke Fasih.",
      );
      return;
    }

    setActionLoading("sync-assignment-backend");
    setActionError(null);
    setActionSuccess(null);

    try {
      await syncSurveyAssignments(surveyPeriodId);
      setActionSuccess("Sync assignment berhasil dijalankan.");
      await loadSurvey();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal sync assignment";
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSyncAssignmentByRegionBackend(regionFullCode: string) {
    if (!surveyPeriodId) {
      return;
    }

    if (!backendFasihAvailable) {
      setActionError(
        "Sync backend nonaktif: backend belum punya akses ke Fasih.",
      );
      return;
    }

    setActionLoading("sync-assignment-region-backend");
    setSyncingRegionFullCode(regionFullCode);
    setActionError(null);
    setActionSuccess(null);

    try {
      await syncSurveyAssignmentsByRegion(surveyPeriodId, regionFullCode);
      setActionSuccess(
        `Sync assignment region ${regionFullCode} berhasil dijalankan.`,
      );
      await loadSurvey();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal sync assignment per region";
      setActionError(message);
    } finally {
      setActionLoading(null);
      setSyncingRegionFullCode(null);
    }
  }

  async function handleAnalyzeAssignments() {
    if (!surveyPeriodId) {
      return;
    }

    setIsAnalyzeLoading(true);
    setAnalyzeError(null);
    setActionError(null);
    setActionSuccess(null);

    try {
      const result = await analyzeSurveyAssignments(surveyPeriodId);
      setActionSuccess(
        `Analyze assignment selesai. ${result.analyzed_assignments}/${result.total_assignments} assignment dianalisis.`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal analyze assignment";
      setAnalyzeError(message);
    } finally {
      setIsAnalyzeLoading(false);
    }
  }

  async function handleAnalyzeAssignmentsByRegion(regionFullCode: string) {
    if (!surveyPeriodId) {
      return;
    }

    setAnalyzingRegionFullCode(regionFullCode);
    setAnalyzeError(null);
    setActionError(null);
    setActionSuccess(null);

    try {
      const result = await analyzeSurveyAssignmentsByRegion(
        surveyPeriodId,
        regionFullCode,
      );
      setActionSuccess(
        `Analyze assignment region ${regionFullCode} selesai. ${result.analyzed_assignments}/${result.total_assignments} assignment dianalisis.`,
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal analyze assignment per region";
      setAnalyzeError(message);
    } finally {
      setAnalyzingRegionFullCode(null);
    }
  }

  function handleChooseImportRegionFile() {
    importRegionInputRef.current?.click();
  }

  function handleChooseImportRegionContactsFile() {
    importRegionContactsInputRef.current?.click();
  }

  function handleChooseImportAssignmentFile() {
    importAssignmentInputRef.current?.click();
  }

  async function handleImportRegionFile(file: File | null) {
    if (!surveyPeriodId || !file) {
      return;
    }

    setActionLoading("import-region");
    setActionError(null);
    setActionSuccess(null);

    try {
      await importSurveyRegions(surveyPeriodId, file);
      setActionSuccess("Import region berhasil dijalankan.");
      await loadSurvey();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal import region";
      setActionError(message);
    } finally {
      setActionLoading(null);
      if (importRegionInputRef.current) {
        importRegionInputRef.current.value = "";
      }
    }
  }

  async function handleImportRegionContactsFile(file: File | null) {
    if (!surveyPeriodId || !file) {
      return;
    }

    setActionLoading("import-region-contacts");
    setActionError(null);
    setActionSuccess(null);

    try {
      await importSurveyRegionContacts(surveyPeriodId, file);
      setActionSuccess("Import PJ, PML, dan PPL berhasil dijalankan.");
      await loadSurvey();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal import kontak region";
      setActionError(message);
    } finally {
      setActionLoading(null);
      if (importRegionContactsInputRef.current) {
        importRegionContactsInputRef.current.value = "";
      }
    }
  }

  async function handleDownloadRegionContactsTemplate() {
    if (!surveyPeriodId) {
      return;
    }

    setActionLoading("download-region-contacts-template");
    setActionError(null);
    setActionSuccess(null);

    try {
      await downloadSurveyRegionContactsTemplate(surveyPeriodId);
      setActionSuccess("Template PJ, PML, dan PPL berhasil diunduh.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal mengunduh template kontak region";
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleImportAssignmentFile(file: File | null) {
    if (!surveyPeriodId || !file) {
      return;
    }

    setActionLoading("import-assignment");
    setActionError(null);
    setActionSuccess(null);

    try {
      await importSurveyAssignments(surveyPeriodId, file);
      setActionSuccess("Import assignment berhasil dijalankan.");
      await loadSurvey();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal import assignment";
      setActionError(message);
    } finally {
      setActionLoading(null);
      if (importAssignmentInputRef.current) {
        importAssignmentInputRef.current.value = "";
      }
    }
  }

  async function handleConnectSurvey() {
    if (!survey) {
      return;
    }

    setActionLoading("connect-survey");
    setActionError(null);
    setActionSuccess(null);

    try {
      const message = await connectSurveyToExtension(survey);
      setActionSuccess(message || "Survey berhasil dihubungkan ke extension.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal menghubungkan survey ke extension";
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  }

  function handleUpdateFormChange(
    key:
      | "name"
      | "survey_id"
      | "xsrf_token"
      | "cookie"
      | "region_level_1"
      | "region_level_2"
      | "log_date_from"
      | "log_date_to",
    value: string,
  ) {
    setUpdateForm((current) => ({ ...current, [key]: value }));
  }

  function handleUpdateDeltaChange(value: string) {
    const trimmed = value.trim();
    if (trimmed === "") {
      setUpdateForm((current) => ({
        ...current,
        log_delta_max_minutes: undefined,
      }));
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }

    setUpdateForm((current) => ({
      ...current,
      log_delta_max_minutes: parsed > 0 ? parsed : undefined,
    }));
  }

  async function handleUpdateSurvey() {
    if (!surveyPeriodId) {
      return;
    }

    setUpdateError(null);
    setUpdateSuccess(null);

    if (
      !updateForm.xsrf_token.trim() ||
      !updateForm.cookie.trim() ||
      !updateForm.region_level_1.trim() ||
      !updateForm.region_level_2.trim() ||
      !updateForm.area_id.trim() ||
      !updateForm.geojson_key.trim()
    ) {
      setUpdateError(
        "xsrf_token, cookie, region level 1, region level 2, area, dan geojson key wajib diisi.",
      );
      return;
    }

    if (
      updateForm.log_date_from &&
      updateForm.log_date_to &&
      new Date(updateForm.log_date_from).getTime() >
        new Date(updateForm.log_date_to).getTime()
    ) {
      setUpdateError(
        "Tanggal awal tidak boleh lebih besar dari tanggal akhir.",
      );
      return;
    }

    const surveyId = survey?.survey_id?.trim() || "";
    if (!surveyId) {
      setUpdateError("Data survey tidak ditemukan.");
      return;
    }

    setUpdateLoading(true);
    try {
      await updateSurvey(surveyPeriodId, {
        name: updateForm.name.trim() || survey?.name || "",
        survey_id: surveyId,
        xsrf_token: updateForm.xsrf_token.trim(),
        cookie: updateForm.cookie.trim(),
        region_level_1: updateForm.region_level_1.trim(),
        region_level_2: updateForm.region_level_2.trim(),
        area_id: updateForm.area_id.trim(),
        geojson_key: updateForm.geojson_key.trim(),
        log_delta_max_minutes: updateForm.log_delta_max_minutes,
        log_date_from: updateForm.log_date_from?.trim() || undefined,
        log_date_to: updateForm.log_date_to?.trim() || undefined,
      });
      setUpdateSuccess("Survey berhasil diupdate.");
      await loadSurvey();
      setIsUpdateDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal update survey";
      setUpdateError(message);
    } finally {
      setUpdateLoading(false);
    }
  }

  async function handleImportCredentialsToUpdateForm() {
    if (!survey || !surveyPeriodId) {
      setUpdateError("Data survey tidak ditemukan.");
      return;
    }

    setUpdateError(null);
    setUpdateSuccess(null);
    setImportCredentialLoading(true);

    try {
      const result = await importSurveyCredentialsFromBrowser({
        survey_id: survey.survey_id,
        survey_period_id: surveyPeriodId,
        survey_label: survey.name,
      });

      console.log(
        "[handleImportCredentialsToUpdateForm] Imported credentials:",
        result,
      );

      setUpdateForm((current) => ({
        ...current,
        xsrf_token: result.xsrf_token,
        cookie: result.cookie,
      }));

      setUpdateSuccess(result.message);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal import kredensial dari browser";
      setUpdateError(message);
    } finally {
      setImportCredentialLoading(false);
    }
  }

  function handleFilterChange(key: keyof RegionCodeFilters, value: string) {
    setRegionPage(1);
    setRegionCodeFilters((current) => {
      if (key === "kdprov") {
        if (isLevel1Locked) {
          return current;
        }

        return {
          kdprov: value,
          kdkab: "",
          kdkec: "",
          kddesa: "",
          kdsls: "",
          kdsubsls: "",
          pj: current.pj,
          pml: current.pml,
          ppl: current.ppl,
        };
      }

      if (key === "kdkab") {
        if (isLevel2Locked) {
          return current;
        }

        return {
          ...current,
          kdkab: value,
          kdkec: "",
          kddesa: "",
          kdsls: "",
          kdsubsls: "",
        };
      }

      if (key === "kdkec") {
        return {
          ...current,
          kdkec: value,
          kddesa: "",
          kdsls: "",
          kdsubsls: "",
        };
      }

      if (key === "kddesa") {
        return {
          ...current,
          kddesa: value,
          kdsls: "",
          kdsubsls: "",
        };
      }

      if (key === "kdsls") {
        return {
          ...current,
          kdsls: value,
          kdsubsls: "",
        };
      }

      if (key === "pj" || key === "pml" || key === "ppl") {
        return {
          ...current,
          [key]: value,
        };
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }

  function handleResetFilter() {
    setRegionCodeFilters(buildInitialRegionFilters(survey));
    setAssignmentAvailabilityFilter("all");
    setRegionStatusFilters([]);
    setRegionPage(1);
  }

  function handleAssignmentAvailabilityFilterChange(
    value: AssignmentAvailabilityFilter,
  ) {
    setAssignmentAvailabilityFilter(value);
    setRegionPage(1);
  }

  function handleRegionStatusFilterChange(
    value: RegionStatusFilter,
    checked: boolean,
  ) {
    setRegionStatusFilters((current) => {
      if (checked) {
        if (current.includes(value)) {
          return current;
        }
        return [...current, value];
      }

      return current.filter((item) => item !== value);
    });
    setRegionPage(1);
  }

  function handleSelectAllRegionStatusFilters() {
    setRegionStatusFilters(
      REGION_STATUS_FILTER_OPTIONS.map((item) => item.value),
    );
    setRegionPage(1);
  }

  function handleClearRegionStatusFilters() {
    setRegionStatusFilters([]);
    setRegionPage(1);
  }

  function handleRegionPageSizeChange(value: string) {
    setRegionPageSize(parseRegionPageSizeParam(value));
    setRegionPage(1);
  }

  return (
    <main className="mx-auto w-full max-w-full space-y-4 p-4 md:p-6">
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="bg-linear-to-br from-stone-100 via-orange-50 to-emerald-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline">Survey Detail</Badge>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/surveys">Kembali ke Daftar Survey</Link>
              </Button>
            </div>
          </div>
          <CardTitle className="font-serif text-3xl break-all">
            {survey?.name || "Memuat survey..."}
          </CardTitle>
          <CardDescription className="text-xs break-all">
            Detail survey aktif dan wilayah.
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Total Region: {regionTotal}</Badge>
            <input
              ref={importRegionInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                void handleImportRegionFile(file);
              }}
            />
            <input
              ref={importRegionContactsInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                void handleImportRegionContactsFile(file);
              }}
            />
            <input
              ref={importAssignmentInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                void handleImportAssignmentFile(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSyncRegionBackend()}
              disabled={
                actionLoading === "sync-region-backend" ||
                backendFasihLoading ||
                !backendFasihAvailable
              }
            >
              {actionLoading === "sync-region-backend"
                ? "Sync Region..."
                : "Sync Region"}
            </Button>
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSyncAssignmentBackend()}
                disabled={
                  actionLoading === "sync-assignment-backend" ||
                  backendFasihLoading ||
                  !backendFasihAvailable
                }
              >
                {actionLoading === "sync-assignment-backend"
                  ? "Sync Assignment..."
                  : "Sync Assignment"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleChooseImportRegionFile}
              disabled={actionLoading === "import-region"}
            >
              {actionLoading === "import-region"
                ? "Import Region..."
                : "Import Region"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleChooseImportRegionContactsFile}
              disabled={actionLoading === "import-region-contacts"}
            >
              {actionLoading === "import-region-contacts"
                ? "Import PJ/PML/PPL..."
                : "Import PJ/PML/PPL"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDownloadRegionContactsTemplate()}
              disabled={actionLoading === "download-region-contacts-template"}
            >
              {actionLoading === "download-region-contacts-template"
                ? "Mengunduh Template..."
                : "Template PJ/PML/PPL"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleChooseImportAssignmentFile}
              disabled={actionLoading === "import-assignment"}
            >
              {actionLoading === "import-assignment"
                ? "Import Assignment..."
                : "Import Assignment"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleConnectSurvey()}
              disabled={actionLoading === "connect-survey" || !survey}
            >
              {actionLoading === "connect-survey"
                ? "Menghubungkan Survey..."
                : "Hubungkan Survey"}
            </Button>
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleAnalyzeAssignments()}
                disabled={isAnalyzeLoading}
              >
                {isAnalyzeLoading
                  ? "Analyze Assignment..."
                  : "Analyze Assignment"}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                setUpdateError(null);
                setIsUpdateDialogOpen(true);
              }}
            >
              Pengaturan
            </Button>
          </div>
        </CardHeader>
      </Card>

      {actionError && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-xs text-rose-700">
            {actionError}
          </CardContent>
        </Card>
      )}
      {actionSuccess && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-xs text-emerald-700">
            {actionSuccess}
          </CardContent>
        </Card>
      )}
      {analyzeError && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-xs text-rose-700">
            {analyzeError}
          </CardContent>
        </Card>
      )}
      {updateSuccess && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-xs text-emerald-700">
            {updateSuccess}
          </CardContent>
        </Card>
      )}
      {!backendFasihLoading && !backendFasihAvailable && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-xs text-amber-700">
            Fitur sinkronisasi belum siap. Periksa konfigurasi lalu coba lagi.
          </CardContent>
        </Card>
      )}
      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-xs text-rose-700">
            {error}
          </CardContent>
        </Card>
      )}
      {loading && !error && (
        <Card>
          <CardContent className="py-3 text-xs">
            Sedang memuat detail survey...
          </CardContent>
        </Card>
      )}

      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pengaturan</DialogTitle>
            <DialogDescription>
              Perbarui nama, akses, dan batasan wilayah survey.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Label className="grid gap-1 md:col-span-2">
                <span>Nama Survey</span>
                <Input
                  value={updateForm.name}
                  onChange={(event) =>
                    handleUpdateFormChange("name", event.target.value)
                  }
                  placeholder="Nama survey"
                />
              </Label>
              <div className="md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleImportCredentialsToUpdateForm()}
                  disabled={importCredentialLoading || updateLoading}
                >
                  {importCredentialLoading
                    ? "Import kredensial..."
                    : "Import Kredensial Browser"}
                </Button>
              </div>
              <Label className="grid gap-1 md:col-span-2">
                <span>XSRF Token</span>
                <Input
                  value={updateForm.xsrf_token}
                  onChange={(event) =>
                    handleUpdateFormChange("xsrf_token", event.target.value)
                  }
                  placeholder="Masukkan token"
                />
              </Label>
              <Label className="grid gap-1 md:col-span-2">
                <span>Cookie</span>
                <Textarea
                  value={updateForm.cookie}
                  onChange={(event) =>
                    handleUpdateFormChange("cookie", event.target.value)
                  }
                  rows={4}
                  className="max-h-48 overflow-y-auto font-mono text-[11px]"
                  placeholder="Masukkan cookie"
                />
              </Label>

              <Label className="grid gap-1">
                <span>Range Tanggal Mulai Log</span>
                <Input
                  type="date"
                  value={updateForm.log_date_from || ""}
                  onChange={(event) =>
                    handleUpdateFormChange("log_date_from", event.target.value)
                  }
                />
              </Label>
              <Label className="grid gap-1">
                <span>Range Tanggal Akhir Log</span>
                <Input
                  type="date"
                  value={updateForm.log_date_to || ""}
                  onChange={(event) =>
                    handleUpdateFormChange("log_date_to", event.target.value)
                  }
                />
              </Label>
              <Label className="grid gap-1">
                <span>Batas Delta Log (menit)</span>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={
                    updateForm.log_delta_max_minutes === undefined
                      ? ""
                      : String(updateForm.log_delta_max_minutes)
                  }
                  onChange={(event) =>
                    handleUpdateDeltaChange(event.target.value)
                  }
                  placeholder="Contoh: 30"
                />
              </Label>
            </div>
            <Button
              type="button"
              onClick={() => void handleUpdateSurvey()}
              disabled={updateLoading}
            >
              {updateLoading ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
            {updateError && (
              <Card className="border-rose-200 bg-rose-50">
                <CardContent className="py-3 text-xs text-rose-700">
                  {updateError}
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-border/70">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>List Region (API)</CardTitle>
            <CardDescription>
              Filter kode wilayah lalu buka detail region untuk melihat peta
              pathway.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={handleResetFilter}>
            Reset Kode
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Label className="grid gap-1">
              <span>Provinsi</span>
              <Select
                value={effectiveLevel1Filter || ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  handleFilterChange(
                    "kdprov",
                    value === ALL_FILTER_VALUE ? "" : value,
                  )
                }
                disabled={isLevel1Locked}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  {!isLevel1Locked && (
                    <SelectItem value={ALL_FILTER_VALUE}>Semua</SelectItem>
                  )}
                  {kdprovOptionsWithSurvey.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value} - {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            <Label className="grid gap-1">
              <span>Kabupaten/Kota</span>
              <Select
                value={effectiveLevel2Filter || ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  handleFilterChange(
                    "kdkab",
                    value === ALL_FILTER_VALUE ? "" : value,
                  )
                }
                disabled={isLevel2Locked || !effectiveLevel1Filter}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  {!isLevel2Locked && (
                    <SelectItem value={ALL_FILTER_VALUE}>Semua</SelectItem>
                  )}
                  {kdkabOptionsWithSurvey.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value} - {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            <Label className="grid gap-1">
              <span>Kecamatan</span>
              <Select
                value={regionCodeFilters.kdkec || ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  handleFilterChange(
                    "kdkec",
                    value === ALL_FILTER_VALUE ? "" : value,
                  )
                }
                disabled={!effectiveLevel2Filter}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Semua</SelectItem>
                  {kdkecOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value} - {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            <Label className="grid gap-1">
              <span>Desa/Kelurahan</span>
              <Select
                value={regionCodeFilters.kddesa || ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  handleFilterChange(
                    "kddesa",
                    value === ALL_FILTER_VALUE ? "" : value,
                  )
                }
                disabled={!regionCodeFilters.kdkec}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Semua</SelectItem>
                  {kddesaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value} - {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            <Label className="grid gap-1">
              <span>SLS/RT</span>
              <Select
                value={regionCodeFilters.kdsls || ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  handleFilterChange(
                    "kdsls",
                    value === ALL_FILTER_VALUE ? "" : value,
                  )
                }
                disabled={!regionCodeFilters.kddesa}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Semua</SelectItem>
                  {kdslsOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value} - {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            <Label className="grid gap-1">
              <span>Sub SLS</span>
              <Select
                value={regionCodeFilters.kdsubsls || ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  handleFilterChange(
                    "kdsubsls",
                    value === ALL_FILTER_VALUE ? "" : value,
                  )
                }
                disabled={!regionCodeFilters.kdsls}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Semua</SelectItem>
                  {kdsubslsOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value} - {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            <Label className="grid gap-1">
              <span>PJ</span>
              <Input
                value={regionCodeFilters.pj}
                onChange={(event) =>
                  handleFilterChange("pj", event.target.value)
                }
                placeholder="Filter PJ"
              />
            </Label>

            <Label className="grid gap-1">
              <span>PML</span>
              <Input
                value={regionCodeFilters.pml}
                onChange={(event) =>
                  handleFilterChange("pml", event.target.value)
                }
                placeholder="Filter PML"
              />
            </Label>

            <Label className="grid gap-1">
              <span>PPL</span>
              <Input
                value={regionCodeFilters.ppl}
                onChange={(event) =>
                  handleFilterChange("ppl", event.target.value)
                }
                placeholder="Filter PPL"
              />
            </Label>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                {/* <TableHead>Provinsi</TableHead>
                <TableHead>Kabupaten/Kota</TableHead> */}
                <TableHead>Kecamatan</TableHead>
                <TableHead>Desa/Kelurahan</TableHead>
                <TableHead>SLS</TableHead>
                <TableHead>Sub SLS</TableHead>
                <TableHead>PJ</TableHead>
                <TableHead>PML</TableHead>
                <TableHead>PPL</TableHead>
                <TableHead>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>Total</span>
                      {selectedStatusCount > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {selectedStatusCount} status
                        </Badge>
                      )}
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant={
                            assignmentAvailabilityFilter === "all" &&
                            regionStatusFilters.length === 0
                              ? "outline"
                              : "default"
                          }
                          aria-label="Filter assignment"
                        >
                          <Filter className="size-3.5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56 p-3">
                        <div className="grid gap-3">
                          <Label className="grid gap-1">
                            <span>Filter Assignment</span>
                            <Select
                              value={assignmentAvailabilityFilter}
                              onValueChange={(value) =>
                                handleAssignmentAvailabilityFilterChange(
                                  value as AssignmentAvailabilityFilter,
                                )
                              }
                            >
                              <SelectTrigger className="h-8 w-full">
                                <SelectValue placeholder="Semua" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Semua</SelectItem>
                                <SelectItem value="has">
                                  Ada Assignment
                                </SelectItem>
                                <SelectItem value="none">
                                  Tidak Ada Assignment
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </Label>
                          <Label className="grid gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <span>Status</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={handleSelectAllRegionStatusFilters}
                                >
                                  Pilih Semua
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={handleClearRegionStatusFilters}
                                >
                                  Bersihkan
                                </Button>
                              </div>
                            </div>
                            <div className="grid gap-2 rounded-sm border p-2">
                              {REGION_STATUS_FILTER_OPTIONS.map((option) => (
                                <label
                                  key={option.value}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <Checkbox
                                    checked={regionStatusFilters.includes(
                                      option.value,
                                    )}
                                    onCheckedChange={(checked) =>
                                      handleRegionStatusFilterChange(
                                        option.value,
                                        checked === true,
                                      )
                                    }
                                  />
                                  <span>{option.label}</span>
                                </label>
                              ))}
                            </div>
                          </Label>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead>Draft</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Rejected</TableHead>
                <TableHead>Revoked</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRegions.map((row) => (
                <TableRow key={row.full_code}>
                  {/* <TableCell>
                    {row.level_1_label || row.level_1 || "-"}
                  </TableCell>
                  <TableCell>
                    {row.level_2_label || row.level_2 || "-"}
                  </TableCell> */}
                  <TableCell>
                    {row.level_3_label || row.level_3 || "-"}
                  </TableCell>
                  <TableCell>
                    {row.level_4_label || row.level_4 || "-"}
                  </TableCell>
                  <TableCell>
                    {row.level_5_label || row.level_5 || "-"}
                  </TableCell>
                  <TableCell>{row.level_6 || "-"}</TableCell>
                  <TableCell>{row.pj || "-"}</TableCell>
                  <TableCell>{row.pml || "-"}</TableCell>
                  <TableCell>{row.ppl || "-"}</TableCell>
                  <TableCell>{row.assignment_count}</TableCell>
                  <TableCell>{row.draft_count ?? 0}</TableCell>
                  <TableCell>{row.submitted_count ?? 0}</TableCell>
                  <TableCell>{row.approved_count ?? 0}</TableCell>
                  <TableCell>{row.rejected_count ?? 0}</TableCell>
                  <TableCell>{row.revoked_count ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to={`/surveys/${surveyPeriodId}/regions/${row.full_code}`}
                        >
                          Detail
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void handleSyncAssignmentByRegionBackend(
                            row.full_code,
                          )
                        }
                        disabled={
                          actionLoading === "sync-assignment-region-backend" ||
                          backendFasihLoading ||
                          !backendFasihAvailable
                        }
                      >
                        {actionLoading === "sync-assignment-region-backend" &&
                        syncingRegionFullCode === row.full_code
                          ? "Syncing..."
                          : "Sync"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void handleAnalyzeAssignmentsByRegion(row.full_code)
                        }
                        disabled={analyzingRegionFullCode !== null}
                      >
                        {analyzingRegionFullCode === row.full_code
                          ? "Analyzing..."
                          : "Analyze"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-muted-foreground">
              Menampilkan{" "}
              {regionTotal === 0
                ? 0
                : (currentRegionPage - 1) * regionPageSize + 1}
              -{Math.min(currentRegionPage * regionPageSize, regionTotal)} dari{" "}
              {regionTotal} data.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Per halaman
                </span>
                <Select
                  value={String(regionPageSize)}
                  onValueChange={handleRegionPageSizeChange}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGION_PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Pagination className="mx-0 w-auto justify-start md:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      text="Sebelumnya"
                      onClick={(event) => {
                        event.preventDefault();
                        setRegionPage((current) => Math.max(1, current - 1));
                      }}
                      aria-disabled={currentRegionPage === 1}
                      className={
                        currentRegionPage === 1
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>

                  {visibleRegionPaginationItems.map((item, index) => {
                    if (item === "ellipsis") {
                      return (
                        <PaginationItem key={`ellipsis-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }

                    return (
                      <PaginationItem key={item}>
                        <PaginationLink
                          href="#"
                          isActive={item === currentRegionPage}
                          onClick={(event) => {
                            event.preventDefault();
                            setRegionPage(item);
                          }}
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      text="Berikutnya"
                      onClick={(event) => {
                        event.preventDefault();
                        setRegionPage((current) =>
                          Math.min(regionTotalPages, current + 1),
                        );
                      }}
                      aria-disabled={currentRegionPage === regionTotalPages}
                      className={
                        currentRegionPage === regionTotalPages
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default SurveyDetailPage;
