export type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

export type GeoJsonFeature = {
  type: "Feature";
  geometry: GeoJsonGeometry;
  properties: {
    idsubsls?: string;
    [key: string]: unknown;
  };
};

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};