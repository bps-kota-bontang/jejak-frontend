export type Area = {
  id: string;
  name: string;
  geojson_file_path: string;
  list_keys: string[];
  description?: string;
  created_at: string;
  updated_at: string;
};

export type CreateAreaRequest = {
  name: string;
  geojson_file_path: string;
  list_keys: string[];
  description?: string;
};

export type UpdateAreaRequest = {
  name?: string;
  geojson_file_path?: string;
  list_keys?: string[];
  description?: string;
};
