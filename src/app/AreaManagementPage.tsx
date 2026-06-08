import { useState, type FormEvent } from "react";
import {
  useAreas,
  useCreateArea,
  useUpdateArea,
  useDeleteArea,
} from "@/hooks/use-areas";
import type { Area, CreateAreaRequest, UpdateAreaRequest } from "@/types/area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { uploadGeoJSONFile } from "@/services/area";
import { API_BASE_URL, requestWithAuth } from "@/lib/http-client";

type FormMode = "create" | "edit";

type FormData = {
  name: string;
  geojson_file_path: string;
  list_keys: string[];
  description?: string;
};

async function extractGeoJSONPropertyKeys(file: File): Promise<string[]> {
  const raw = await file.text();
  const parsed = JSON.parse(raw) as {
    features?: Array<{ properties?: Record<string, unknown> }>;
  };

  const features = Array.isArray(parsed.features) ? parsed.features : [];
  const keySet = new Set<string>();

  for (const feature of features) {
    const properties = feature?.properties;
    if (!properties || typeof properties !== "object") {
      continue;
    }
    for (const key of Object.keys(properties)) {
      const trimmed = key.trim();
      if (trimmed) {
        keySet.add(trimmed);
      }
    }
  }

  return Array.from(keySet).sort((a, b) => a.localeCompare(b));
}

function buildGeoJSONDownloadURL(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const normalizedPath =
    trimmed.startsWith("/static/") || trimmed === "/static"
      ? trimmed
      : trimmed.startsWith("/")
        ? `/static${trimmed}`
        : `/static/${trimmed}`;

  const origin = new URL(API_BASE_URL).origin;
  return `${origin}${normalizedPath}`;
}

function getGeoJSONFileName(path: string): string {
  const fileName = path.split("/").pop();
  if (!fileName || fileName.trim() === "") {
    return "area.geojson";
  }
  return fileName;
}

const AreaManagementPage = () => {
  const { data: areas, isLoading, error: loadError } = useAreas();
  const createAreaMutation = useCreateArea();
  const deleteAreaMutation = useDeleteArea();

  const [showDialog, setShowDialog] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);

  const updateAreaMutation = useUpdateArea(selectedArea?.id || "");

  const [form, setForm] = useState<FormData>({
    name: "",
    geojson_file_path: "",
    list_keys: [],
    description: "",
  });
  const [selectedGeoJSONFile, setSelectedGeoJSONFile] = useState<File | null>(
    null,
  );
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [availableGeoJSONKeys, setAvailableGeoJSONKeys] = useState<string[]>(
    [],
  );
  const [geoJSONKeyFilter, setGeoJSONKeyFilter] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSubmitting =
    createAreaMutation.isPending ||
    updateAreaMutation.isPending ||
    deleteAreaMutation.isPending ||
    isUploadingFile;

  function handleFormChange(key: keyof FormData, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm({
      name: "",
      geojson_file_path: "",
      list_keys: [],
      description: "",
    });
    setSelectedGeoJSONFile(null);
    setAvailableGeoJSONKeys([]);
    setGeoJSONKeyFilter("");
    setSubmitError(null);
  }

  function openCreateDialog() {
    setFormMode("create");
    setSelectedArea(null);
    resetForm();
    setShowDialog(true);
  }

  function openEditDialog(area: Area) {
    setFormMode("edit");
    setSelectedArea(area);
    setForm({
      name: area.name,
      geojson_file_path: area.geojson_file_path,
      list_keys: area.list_keys || [],
      description: area.description || "",
    });
    setSelectedGeoJSONFile(null);
    setAvailableGeoJSONKeys(area.list_keys || []);
    setGeoJSONKeyFilter("");
    setSubmitError(null);
    setShowDialog(true);
  }

  function openDeleteDialog(area: Area) {
    setAreaToDelete(area);
    setShowDeleteDialog(true);
  }

  async function handleGeoJSONFileChange(file: File | null) {
    setSelectedGeoJSONFile(file);

    if (!file) {
      setAvailableGeoJSONKeys(form.list_keys);
      return;
    }

    try {
      const keys = await extractGeoJSONPropertyKeys(file);
      if (keys.length === 0) {
        setSubmitError("File GeoJSON tidak memiliki properties key.");
        setAvailableGeoJSONKeys([]);
        setForm((current) => ({ ...current, list_keys: [] }));
        return;
      }

      setSubmitError(null);
      setAvailableGeoJSONKeys(keys);
      setForm((current) => ({ ...current, list_keys: keys }));
    } catch {
      setSubmitError("Gagal membaca key dari file GeoJSON.");
      setAvailableGeoJSONKeys([]);
      setForm((current) => ({ ...current, list_keys: [] }));
    }
  }

  function toggleGeoJSONKeySelection(key: string, checked: boolean) {
    setForm((current) => {
      if (checked) {
        if (current.list_keys.includes(key)) {
          return current;
        }
        return { ...current, list_keys: [...current.list_keys, key] };
      }
      return {
        ...current,
        list_keys: current.list_keys.filter((item) => item !== key),
      };
    });
  }

  function selectAllGeoJSONKeys() {
    setForm((current) => ({
      ...current,
      list_keys: [...availableGeoJSONKeys],
    }));
  }

  function clearAllGeoJSONKeys() {
    setForm((current) => ({ ...current, list_keys: [] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!form.name.trim()) {
      setSubmitError("Nama area wajib diisi");
      return;
    }

    try {
      let geoJSONFilePath = form.geojson_file_path.trim();

      if (selectedGeoJSONFile) {
        setIsUploadingFile(true);
        geoJSONFilePath = await uploadGeoJSONFile(selectedGeoJSONFile);
        setForm((current) => ({
          ...current,
          geojson_file_path: geoJSONFilePath,
        }));
      }

      if (!geoJSONFilePath) {
        setSubmitError("File GeoJSON wajib diupload");
        return;
      }

      if (form.list_keys.length === 0) {
        setSubmitError("Pilih minimal satu key properties GeoJSON");
        return;
      }

      if (formMode === "create") {
        const payload: CreateAreaRequest = {
          name: form.name.trim(),
          geojson_file_path: geoJSONFilePath,
          list_keys: form.list_keys,
          description: form.description?.trim() || undefined,
        };
        await createAreaMutation.mutateAsync(payload);
      } else if (formMode === "edit" && selectedArea) {
        const payload: UpdateAreaRequest = {
          name: form.name.trim(),
          geojson_file_path: geoJSONFilePath,
          list_keys: form.list_keys,
          description: form.description?.trim() || undefined,
        };
        await updateAreaMutation.mutateAsync(payload);
      }

      setShowDialog(false);
      resetForm();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan area";
      setSubmitError(message);
    } finally {
      setIsUploadingFile(false);
    }
  }

  async function handleDelete() {
    if (!areaToDelete) return;

    try {
      await deleteAreaMutation.mutateAsync(areaToDelete.id);
      setShowDeleteDialog(false);
      setAreaToDelete(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus area";
      setSubmitError(message);
    }
  }

  async function handleDownloadGeoJSON(area: Area) {
    const downloadURL = buildGeoJSONDownloadURL(area.geojson_file_path);
    if (!downloadURL) {
      setSubmitError("File GeoJSON belum tersedia untuk area ini");
      return;
    }

    try {
      setSubmitError(null);
      const response = await requestWithAuth(downloadURL, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("download failed");
      }

      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectURL;
      anchor.download = getGeoJSONFileName(area.geojson_file_path);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectURL);
    } catch {
      setSubmitError("Gagal download file GeoJSON");
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Area GeoJSON</h1>
          <p className="text-muted-foreground">
            Kelola area dan file GeoJSON yang digunakan dalam survey
          </p>
        </div>
        <Button onClick={openCreateDialog} disabled={isSubmitting}>
          Tambah Area
        </Button>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>
            Gagal memuat data:{" "}
            {loadError instanceof Error ? loadError.message : "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4">
          {areas && areas.length > 0 ? (
            areas.map((area) => (
              <Card key={area.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <CardTitle>{area.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Total key: {area.list_keys?.length || 0}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {formatDate(area.created_at)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      List Key
                    </p>
                    {area.list_keys && area.list_keys.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {area.list_keys.map((key) => (
                          <Badge key={key} variant="secondary">
                            {key}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Belum ada key
                      </p>
                    )}
                  </div>

                  {area.description && (
                    <p className="text-sm text-muted-foreground">
                      {area.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleDownloadGeoJSON(area)}
                      disabled={isSubmitting || !area.geojson_file_path}
                    >
                      Download GeoJSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(area)}
                      disabled={isSubmitting}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog(area)}
                      disabled={isSubmitting}
                    >
                      Hapus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">
                  Tidak ada area yang tersedia
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="w-[96vw] max-w-6xl p-6 sm:w-[94vw] sm:p-7 lg:w-[92vw] lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {formMode === "create" ? "Tambah Area" : "Edit Area"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Buat area baru untuk mengorganisir file GeoJSON"
                : "Ubah informasi area"}
            </DialogDescription>
          </DialogHeader>

          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Area *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                placeholder="Contoh: Area Kota Bontang"
                disabled={isSubmitting}
                className="w-full min-w-0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="geojson_file">File GeoJSON *</Label>
              <Input
                id="geojson_file"
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                onChange={(e) =>
                  handleGeoJSONFileChange(e.target.files?.[0] || null)
                }
                disabled={isSubmitting}
                className="w-full min-w-0"
              />
              {formMode === "edit" && form.geojson_file_path && (
                <p className="text-xs text-muted-foreground">
                  File saat ini: {form.geojson_file_path}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="geojson_key_filter">List Key Properties *</Label>
              <Input
                id="geojson_key_filter"
                value={geoJSONKeyFilter}
                onChange={(e) => setGeoJSONKeyFilter(e.target.value)}
                placeholder="Filter key..."
                disabled={isSubmitting || availableGeoJSONKeys.length === 0}
                className="w-full min-w-0"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllGeoJSONKeys}
                  disabled={isSubmitting || availableGeoJSONKeys.length === 0}
                >
                  Pilih Semua
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearAllGeoJSONKeys}
                  disabled={isSubmitting || form.list_keys.length === 0}
                >
                  Kosongkan
                </Button>
              </div>
              <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                {availableGeoJSONKeys
                  .filter((key) =>
                    key.toLowerCase().includes(geoJSONKeyFilter.toLowerCase()),
                  )
                  .map((key) => {
                    const checked = form.list_keys.includes(key);
                    return (
                      <label
                        key={key}
                        className="flex min-w-0 items-start gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            toggleGeoJSONKeySelection(key, e.target.checked)
                          }
                          disabled={isSubmitting}
                        />
                        <span className="break-all leading-5">{key}</span>
                      </label>
                    );
                  })}
                {availableGeoJSONKeys.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Upload file GeoJSON untuk menampilkan key properties.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Key terpilih: {form.list_keys.length}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  handleFormChange("description", e.target.value)
                }
                placeholder="Deskripsi area (opsional)"
                disabled={isSubmitting}
                rows={3}
                className="w-full min-w-0"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isUploadingFile
                  ? "Mengupload file..."
                  : isSubmitting
                    ? "Menyimpan..."
                    : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Area</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus area "{areaToDelete?.name}"?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AreaManagementPage;
