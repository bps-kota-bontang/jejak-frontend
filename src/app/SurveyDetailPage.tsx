import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  analyzeSurveyAssignments,
  fetchSurveyByPeriodId,
  syncSurveyAssignments,
  updateSurvey,
} from "@/services/survey";
import { fetchSurveyRegions, syncSurveyRegions } from "@/services/region";
import { fetchSystemFeatures } from "@/services/system";
import type { Survey, UpdateSurveyRequest } from "@/types/survey";
import type { SurveyRegion } from "@/types/region";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
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

type RegionCodeFilters = {
  kdprov: string;
  kdkab: string;
  kdkec: string;
  kddesa: string;
  kdsls: string;
  kdsubsls: string;
};

const defaultRegionCodeFilters: RegionCodeFilters = {
  kdprov: "",
  kdkab: "",
  kdkec: "",
  kddesa: "",
  kdsls: "",
  kdsubsls: "",
};

const ALL_FILTER_VALUE = "__all__";
const REGION_PAGE_SIZE = 10;

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
  };
}

type OptionItem = {
  value: string;
  label: string;
};

function getCodeByFilterKey(
  row: SurveyRegion,
  key: keyof RegionCodeFilters,
): string {
  if (key === "kdprov") {
    return row.level_1 || "";
  }
  if (key === "kdkab") {
    return row.level_2 || "";
  }
  if (key === "kdkec") {
    return row.level_3 || "";
  }
  if (key === "kddesa") {
    return row.level_4 || "";
  }
  if (key === "kdsls") {
    return row.level_5 || "";
  }

  return row.level_6 || "";
}

function getLabelByFilterKey(
  row: SurveyRegion,
  key: keyof RegionCodeFilters,
): string {
  if (key === "kdprov") {
    return row.level_1_label || row.level_1 || "";
  }
  if (key === "kdkab") {
    return row.level_2_label || row.level_2 || "";
  }
  if (key === "kdkec") {
    return row.level_3_label || row.level_3 || "";
  }
  if (key === "kddesa") {
    return row.level_4_label || row.level_4 || "";
  }
  if (key === "kdsls") {
    return row.level_5_label || row.level_5 || "";
  }

  return row.level_6 || "";
}

function buildOptions(
  rows: SurveyRegion[],
  key: keyof RegionCodeFilters,
): OptionItem[] {
  const map = new Map<string, string>();

  for (const row of rows) {
    const value = getCodeByFilterKey(row, key);
    const label = getLabelByFilterKey(row, key);

    if (!value) {
      continue;
    }

    if (!map.has(value)) {
      map.set(value, label);
    }
  }

  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

const SurveyDetailPage = () => {
  const { surveyPeriodId = "" } = useParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [regions, setRegions] = useState<SurveyRegion[]>([]);
  const [regionCodeFilters, setRegionCodeFilters] = useState<RegionCodeFilters>(
    defaultRegionCodeFilters,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<
    "sync-region" | "sync-assignment" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isAnalyzeLoading, setIsAnalyzeLoading] = useState(false);
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
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [fasihAvailable, setFasihAvailable] = useState(false);
  const [fasihStatusLoading, setFasihStatusLoading] = useState(true);
  const [regionPage, setRegionPage] = useState(1);

  console.log("survey", survey);

  const isLevel1Locked = Boolean(survey?.region_level_1);
  const isLevel2Locked = Boolean(survey?.region_level_2);
  const effectiveLevel1Filter =
    survey?.region_level_1 || regionCodeFilters.kdprov;
  const effectiveLevel2Filter =
    survey?.region_level_2 || regionCodeFilters.kdkab;

  const kdprovOptions = useMemo(
    () => buildOptions(regions, "kdprov"),
    [regions],
  );

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

  const kdkabOptions = useMemo(
    () =>
      buildOptions(
        regions.filter(
          (row) =>
            !effectiveLevel1Filter || row.level_1 === effectiveLevel1Filter,
        ),
        "kdkab",
      ),
    [effectiveLevel1Filter, regions],
  );

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

  const kdkecOptions = useMemo(
    () =>
      buildOptions(
        regions
          .filter(
            (row) =>
              !effectiveLevel1Filter || row.level_1 === effectiveLevel1Filter,
          )
          .filter(
            (row) =>
              !effectiveLevel2Filter || row.level_2 === effectiveLevel2Filter,
          ),
        "kdkec",
      ),
    [effectiveLevel1Filter, effectiveLevel2Filter, regions],
  );

  const kddesaOptions = useMemo(
    () =>
      buildOptions(
        regions
          .filter(
            (row) =>
              !effectiveLevel1Filter || row.level_1 === effectiveLevel1Filter,
          )
          .filter(
            (row) =>
              !effectiveLevel2Filter || row.level_2 === effectiveLevel2Filter,
          )
          .filter(
            (row) =>
              !regionCodeFilters.kdkec ||
              row.level_3 === regionCodeFilters.kdkec,
          ),
        "kddesa",
      ),
    [
      effectiveLevel1Filter,
      effectiveLevel2Filter,
      regionCodeFilters.kdkec,
      regions,
    ],
  );

  const kdslsOptions = useMemo(
    () =>
      buildOptions(
        regions
          .filter(
            (row) =>
              !effectiveLevel1Filter || row.level_1 === effectiveLevel1Filter,
          )
          .filter(
            (row) =>
              !effectiveLevel2Filter || row.level_2 === effectiveLevel2Filter,
          )
          .filter(
            (row) =>
              !regionCodeFilters.kdkec ||
              row.level_3 === regionCodeFilters.kdkec,
          )
          .filter(
            (row) =>
              !regionCodeFilters.kddesa ||
              row.level_4 === regionCodeFilters.kddesa,
          ),
        "kdsls",
      ),
    [
      effectiveLevel1Filter,
      effectiveLevel2Filter,
      regionCodeFilters.kdkec,
      regionCodeFilters.kddesa,
      regions,
    ],
  );

  const kdsubslsOptions = useMemo(
    () =>
      buildOptions(
        regions
          .filter(
            (row) =>
              !effectiveLevel1Filter || row.level_1 === effectiveLevel1Filter,
          )
          .filter(
            (row) =>
              !effectiveLevel2Filter || row.level_2 === effectiveLevel2Filter,
          )
          .filter(
            (row) =>
              !regionCodeFilters.kdkec ||
              row.level_3 === regionCodeFilters.kdkec,
          )
          .filter(
            (row) =>
              !regionCodeFilters.kddesa ||
              row.level_4 === regionCodeFilters.kddesa,
          )
          .filter(
            (row) =>
              !regionCodeFilters.kdsls ||
              row.level_5 === regionCodeFilters.kdsls,
          ),
        "kdsubsls",
      ),
    [
      effectiveLevel1Filter,
      effectiveLevel2Filter,
      regionCodeFilters.kdkec,
      regionCodeFilters.kddesa,
      regionCodeFilters.kdsls,
      regions,
    ],
  );

  const filteredRegions = useMemo(
    () =>
      regions
        .filter(
          (row) =>
            !effectiveLevel1Filter || row.level_1 === effectiveLevel1Filter,
        )
        .filter(
          (row) =>
            !effectiveLevel2Filter || row.level_2 === effectiveLevel2Filter,
        )
        .filter(
          (row) =>
            !regionCodeFilters.kdkec || row.level_3 === regionCodeFilters.kdkec,
        )
        .filter(
          (row) =>
            !regionCodeFilters.kddesa ||
            row.level_4 === regionCodeFilters.kddesa,
        )
        .filter(
          (row) =>
            !regionCodeFilters.kdsls || row.level_5 === regionCodeFilters.kdsls,
        )
        .filter(
          (row) =>
            !regionCodeFilters.kdsubsls ||
            row.level_6 === regionCodeFilters.kdsubsls,
        )
        .sort((a, b) => a.full_code.localeCompare(b.full_code)),
    [effectiveLevel1Filter, effectiveLevel2Filter, regionCodeFilters, regions],
  );

  const totalRegionPages = Math.max(
    1,
    Math.ceil(filteredRegions.length / REGION_PAGE_SIZE),
  );

  const paginatedRegions = useMemo(
    () =>
      filteredRegions.slice(
        (regionPage - 1) * REGION_PAGE_SIZE,
        regionPage * REGION_PAGE_SIZE,
      ),
    [filteredRegions, regionPage],
  );

  async function loadSurvey() {
    if (!surveyPeriodId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const surveyResult = await fetchSurveyByPeriodId(surveyPeriodId);
      const regionResult = await fetchSurveyRegions(surveyPeriodId, {
        region_level_1: surveyResult.region_level_1,
        region_level_2: surveyResult.region_level_2,
      });

      setSurvey(surveyResult);
      setRegions(regionResult);
      setRegionCodeFilters(buildInitialRegionFilters(surveyResult));
      setRegionPage(1);
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
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSurvey();
  }, [surveyPeriodId]);

  useEffect(() => {
    setRegionPage(1);
  }, [regionCodeFilters]);

  useEffect(() => {
    let active = true;

    const loadSystemFeatures = async () => {
      setFasihStatusLoading(true);
      try {
        const result = await fetchSystemFeatures();
        if (active) {
          setFasihAvailable(result.fasih_available);
        }
      } catch {
        if (active) {
          setFasihAvailable(false);
        }
      } finally {
        if (active) {
          setFasihStatusLoading(false);
        }
      }
    };

    void loadSystemFeatures();

    return () => {
      active = false;
    };
  }, []);

  async function handleSyncRegion() {
    if (!surveyPeriodId) {
      return;
    }

    setActionLoading("sync-region");
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

  async function handleSyncAssignment() {
    if (!surveyPeriodId) {
      return;
    }

    setActionLoading("sync-assignment");
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

  async function handleAnalyzeAssignments() {
    if (!surveyPeriodId) {
      return;
    }

    setIsAnalyzeLoading(true);
    setAnalyzeError(null);

    try {
      const result = await analyzeSurveyAssignments(surveyPeriodId);
      setActionSuccess(
        `Analyze assignment selesai. ${result.analyzed_assignments}/${result.total_assignments} assignment dianalisis.`,
      );
      setActionError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal analyze assignment";
      setAnalyzeError(message);
    } finally {
      setIsAnalyzeLoading(false);
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

  function handleFilterChange(key: keyof RegionCodeFilters, value: string) {
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

      return {
        ...current,
        [key]: value,
      };
    });
  }

  function handleResetFilter() {
    setRegionCodeFilters(buildInitialRegionFilters(survey));
    setRegionPage(1);
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
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
            <Badge variant="outline">
              Total Region: {filteredRegions.length}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSyncRegion()}
              disabled={
                actionLoading === "sync-region" ||
                fasihStatusLoading ||
                !fasihAvailable
              }
            >
              {actionLoading === "sync-region"
                ? "Menyinkronkan..."
                : fasihStatusLoading
                  ? "Memeriksa akses..."
                  : "Sync Region"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSyncAssignment()}
              disabled={
                actionLoading === "sync-assignment" ||
                fasihStatusLoading ||
                !fasihAvailable
              }
            >
              {actionLoading === "sync-assignment"
                ? "Menyinkronkan..."
                : fasihStatusLoading
                  ? "Memeriksa akses..."
                  : "Sync Assignment"}
            </Button>
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
                disabled={
                  isLevel2Locked ||
                  (!effectiveLevel1Filter && kdprovOptions.length > 0)
                }
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
                disabled={!regionCodeFilters.kdkab && kdkabOptions.length > 0}
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
                disabled={!regionCodeFilters.kdkec && kdkecOptions.length > 0}
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
                disabled={!regionCodeFilters.kddesa && kddesaOptions.length > 0}
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
                disabled={!regionCodeFilters.kdsls && kdslsOptions.length > 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Semua</SelectItem>
                  {kdsubslsOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provinsi</TableHead>
                <TableHead>Kabupaten/Kota</TableHead>
                <TableHead>Kecamatan</TableHead>
                <TableHead>Desa/Kelurahan</TableHead>
                <TableHead>SLS</TableHead>
                <TableHead>Sub SLS</TableHead>
                <TableHead>Jumlah Assignment</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRegions.map((row) => (
                <TableRow key={row.full_code}>
                  <TableCell>
                    {row.level_1_label || row.level_1 || "-"}
                  </TableCell>
                  <TableCell>
                    {row.level_2_label || row.level_2 || "-"}
                  </TableCell>
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
                  <TableCell>{row.assignment_count}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={`/surveys/${surveyPeriodId}/regions/${row.full_code}`}
                      >
                        Detail Region
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-muted-foreground">
              Menampilkan{" "}
              {filteredRegions.length === 0
                ? 0
                : (regionPage - 1) * REGION_PAGE_SIZE + 1}
              -{Math.min(regionPage * REGION_PAGE_SIZE, filteredRegions.length)}{" "}
              dari {filteredRegions.length} data.
            </p>
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
                    aria-disabled={regionPage === 1}
                    className={
                      regionPage === 1
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                  />
                </PaginationItem>

                {Array.from(
                  { length: totalRegionPages },
                  (_, index) => index + 1,
                ).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      isActive={page === regionPage}
                      onClick={(event) => {
                        event.preventDefault();
                        setRegionPage(page);
                      }}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text="Berikutnya"
                    onClick={(event) => {
                      event.preventDefault();
                      setRegionPage((current) =>
                        Math.min(totalRegionPages, current + 1),
                      );
                    }}
                    aria-disabled={regionPage === totalRegionPages}
                    className={
                      regionPage === totalRegionPages
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default SurveyDetailPage;
