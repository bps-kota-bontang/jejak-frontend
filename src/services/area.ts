import type { Area, CreateAreaRequest, UpdateAreaRequest } from "@/types/area";
import { API_BASE_URL, requestJson } from "@/lib/http-client";

type UploadGeoJSONResponse = {
  geojson_file_path: string;
};

export async function fetchAreas(): Promise<Area[]> {
  return requestJson<Area[]>(`${API_BASE_URL}/areas`);
}

export async function fetchAreaById(id: string): Promise<Area> {
  return requestJson<Area>(`${API_BASE_URL}/areas/${id}`);
}

export async function createArea(payload: CreateAreaRequest): Promise<void> {
  await requestJson<null>(`${API_BASE_URL}/areas`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadGeoJSONFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const data = await requestJson<UploadGeoJSONResponse>(
    `${API_BASE_URL}/areas/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  return data.geojson_file_path;
}

export async function updateArea(
  id: string,
  payload: UpdateAreaRequest,
): Promise<void> {
  await requestJson<null>(`${API_BASE_URL}/areas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteArea(id: string): Promise<void> {
  await requestJson<null>(`${API_BASE_URL}/areas/${id}`, {
    method: "DELETE",
  });
}
