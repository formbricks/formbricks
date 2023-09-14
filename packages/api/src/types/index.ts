export interface ApiConfig {
  environmentId: string;
  apiHost: string;
}

export type ApiResponse<T> = {
  data: T;
};
