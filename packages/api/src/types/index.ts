export type NetworkError = {
  code: "network_error";
  message: string;
  status: number;
  url: URL;
};

export interface ApiConfig {
  environmentId: string;
  apiHost: string;
}

export type ApiResponse<T> = {
  data: T;
};
