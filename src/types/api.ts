export type ApiEnvelope<T> = {
  data: T;
  message: string;
  errors?: string[];
  meta?: unknown;
};