import type { GeoJsonFeature, GeoJsonFeatureCollection } from "@/types/geojson";
import { API_ORIGIN, requestWithAuth } from "@/lib/http-client";

function resolveGeoJsonUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const normalizedPath =
    trimmed.startsWith("/static/") || trimmed === "/static"
      ? trimmed
      : trimmed.startsWith("/")
        ? `/static${trimmed}`
        : `/static/${trimmed}`;

  return new URL(normalizedPath, API_ORIGIN).toString();
}

export async function fetchGeoJsonFeatureByKey(
  keyValue: string,
  key: string = "idsubsls",
  geoJsonUrl: string,
): Promise<GeoJsonFeature | null> {
  const response = await requestWithAuth(resolveGeoJsonUrl(geoJsonUrl), {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Gagal memuat file GeoJSON region");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error("Response GeoJSON tidak valid (HTML)");
  }

  const raw = await response.text();
  const collection = JSON.parse(raw) as GeoJsonFeatureCollection;
  const normalizedValue = keyValue.trim();

  return (
    collection.features.find(
      (feature) => {
        const value = feature.properties[key];
        const normalizedPropertyValue =
          typeof value === "string"
            ? value.trim()
            : value == null
              ? ""
              : String(value).trim();

        return normalizedPropertyValue === normalizedValue;
      },
    ) || null
  );
}
