import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { createSurvey, fetchSurveys } from "@/services/survey";
import type { CreateSurveyRequest, Survey } from "@/types/survey";
import { useAreas } from "@/hooks/use-areas";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const SurveyListPage = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: areas } = useAreas();
  const [form, setForm] = useState<CreateSurveyRequest>({
    name: "",
    survey_id: "",
    survey_period_id: "",
    xsrf_token: "",
    cookie: "",
    region_level_1: "",
    region_level_2: "",
    area_id: "",
    geojson_key: "",
  });

  const selectedArea = useMemo(() => {
    if (!areas || !form.area_id) {
      return undefined;
    }
    return areas.find((area) => area.id === form.area_id);
  }, [areas, form.area_id]);

  const geoJSONKeyOptions = useMemo(
    () => selectedArea?.list_keys || [],
    [selectedArea],
  );

  const totalSurveys = useMemo(() => surveys.length, [surveys]);

  async function loadSurveys() {
    console.log("Loading surveys...");
    setLoading(true);
    setError(null);

    try {
      const data = await fetchSurveys();
      setSurveys(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat surveys";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSurveys();
  }, []);

  function handleFormChange(
    key: keyof CreateSurveyRequest,
    value: string | undefined,
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetCreateForm() {
    setForm({
      name: "",
      survey_id: "",
      survey_period_id: "",
      xsrf_token: "",
      cookie: "",
      region_level_1: "",
      region_level_2: "",
      area_id: "",
      geojson_key: "",
    });
  }

  async function handleSubmitSurveyForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (
      !form.name.trim() ||
      !form.survey_id.trim() ||
      !form.survey_period_id.trim() ||
      !form.xsrf_token.trim() ||
      !form.cookie.trim() ||
      !form.region_level_1.trim() ||
      !form.region_level_2.trim() ||
      !form.area_id.trim() ||
      !form.geojson_key.trim()
    ) {
      setSubmitError(
        "Nama, kode survey, kode periode, xsrf_token, cookie, region level 1, region level 2, area, dan geojson key wajib diisi.",
      );
      return;
    }

    setSubmitLoading(true);
    try {
      await createSurvey({
        name: form.name.trim(),
        survey_id: form.survey_id.trim(),
        survey_period_id: form.survey_period_id.trim(),
        xsrf_token: form.xsrf_token.trim(),
        cookie: form.cookie.trim(),
        region_level_1: form.region_level_1.trim(),
        region_level_2: form.region_level_2.trim(),
        area_id: form.area_id.trim(),
        geojson_key: form.geojson_key.trim(),
      });

      setSubmitSuccess("Survey berhasil dibuat.");
      await loadSurveys();
      setShowCreateModal(false);
      resetCreateForm();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan survey";
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="bg-linear-to-br from-stone-100 via-orange-50 to-emerald-100">
          <CardDescription className="text-primary text-[11px] font-bold tracking-[0.08em] uppercase">
            Jejak Survey Dashboard
          </CardDescription>
          <CardTitle className="font-serif text-3xl">Daftar Survey</CardTitle>
          <CardDescription className="max-w-2xl text-xs">
            Pantau daftar survey aktif dan lanjut ke halaman detail untuk
            melihat daftar assignment per wilayah.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <Badge variant="outline">Total Survey: {totalSurveys}</Badge>
          <Button
            type="button"
            onClick={() => {
              setSubmitError(null);
              setSubmitSuccess(null);
              setShowCreateModal(true);
            }}
          >
            Tambah Survey
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={loadSurveys}
            disabled={loading}
          >
            {loading ? "Memuat..." : "Muat Ulang"}
          </Button>
        </CardContent>
      </Card>

      {submitSuccess && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-xs text-emerald-700">
            {submitSuccess}
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
            Sedang memuat data survey...
          </CardContent>
        </Card>
      )}

      {!loading && !error && surveys.length === 0 && (
        <Card>
          <CardContent className="py-3 text-xs">
            Belum ada data survey.
          </CardContent>
        </Card>
      )}

      {!loading && !error && surveys.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {surveys.map((survey) => (
            <Card
              key={survey.id}
              className="border-border/70 transition-colors hover:border-primary/40"
            >
              <CardHeader className="gap-2 pb-2">
                <CardTitle className="text-sm leading-relaxed break-all">
                  {survey.name || "Survey tanpa nama"}
                </CardTitle>
                <CardDescription>Survey aktif</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <dl className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Dibuat</dt>
                    <dd>{formatDate(survey.created_at)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Diperbarui</dt>
                    <dd>{formatDate(survey.updated_at)}</dd>
                  </div>
                </dl>

                <Button asChild size="sm" className="w-full">
                  <Link to={`/surveys/${survey.survey_period_id}`}>
                    Lihat Detail
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Survey</DialogTitle>
            <DialogDescription>
              Isi nama survey dan data pendukung untuk membuat survey baru.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            onSubmit={handleSubmitSurveyForm}
          >
            <Label className="grid gap-1 md:col-span-2">
              <span>Nama Survey *</span>
              <Input
                value={form.name}
                onChange={(event) =>
                  handleFormChange("name", event.target.value)
                }
                placeholder="Contoh: Survei Produksi Tahunan"
              />
            </Label>
            <Label className="grid gap-1 md:col-span-2">
              <span>Kode Survey *</span>
              <Input
                value={form.survey_id}
                onChange={(event) =>
                  handleFormChange("survey_id", event.target.value)
                }
                placeholder="Masukkan kode survey"
              />
            </Label>
            <Label className="grid gap-1 md:col-span-2">
              <span>Kode Periode Survey *</span>
              <Input
                value={form.survey_period_id}
                onChange={(event) =>
                  handleFormChange("survey_period_id", event.target.value)
                }
                placeholder="Masukkan kode periode survey"
              />
            </Label>
            <Label className="grid gap-1 md:col-span-2">
              <span>XSRF Token *</span>
              <Input
                value={form.xsrf_token}
                onChange={(event) =>
                  handleFormChange("xsrf_token", event.target.value)
                }
                placeholder="Masukkan token"
              />
            </Label>
            <Label className="grid gap-1 md:col-span-2">
              <span>Cookie *</span>
              <Textarea
                value={form.cookie}
                onChange={(event) =>
                  handleFormChange("cookie", event.target.value)
                }
                placeholder="Masukkan cookie"
                rows={4}
                className="max-h-48 overflow-y-auto font-mono text-[11px]"
              />
            </Label>
            <Label className="grid gap-1">
              <span>Region Level 1 *</span>
              <Input
                value={form.region_level_1 || ""}
                onChange={(event) =>
                  handleFormChange("region_level_1", event.target.value)
                }
                placeholder="64"
              />
            </Label>
            <Label className="grid gap-1">
              <span>Region Level 2 *</span>
              <Input
                value={form.region_level_2 || ""}
                onChange={(event) =>
                  handleFormChange("region_level_2", event.target.value)
                }
                placeholder="74"
              />
            </Label>
            <Label className="grid gap-1 md:col-span-2">
              <span>Area *</span>
              <Select
                value={form.area_id || ""}
                onValueChange={(value) => {
                  handleFormChange("area_id", value);
                  handleFormChange("geojson_key", "");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih area..." />
                </SelectTrigger>
                <SelectContent>
                  {areas && areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label className="grid gap-1 md:col-span-2">
              <span>GeoJSON Key *</span>
              <Select
                value={form.geojson_key || ""}
                onValueChange={(value) => handleFormChange("geojson_key", value)}
                disabled={!form.area_id || geoJSONKeyOptions.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !form.area_id
                        ? "Pilih area terlebih dahulu"
                        : geoJSONKeyOptions.length === 0
                          ? "Area tidak memiliki key"
                          : "Pilih GeoJSON key..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {geoJSONKeyOptions.map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            <div className="flex items-end md:col-span-2">
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
          {submitError && (
            <Card className="border-rose-200 bg-rose-50">
              <CardContent className="py-3 text-xs text-rose-700">
                {submitError}
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default SurveyListPage;
