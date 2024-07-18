export interface ApiConfig {
  environmentId: string;
  apiHost: string;
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

export interface ApiSuccessResponse<T = Record<string, unknown>> {
  data: T;
}

export interface ApiErrorResponse {
  code:
    | "not_found"
    | "gone"
    | "bad_request"
    | "internal_server_error"
    | "unauthorized"
    | "method_not_allowed"
    | "not_authenticated"
    | "forbidden";
  message: string;
  details: Record<string, string | string[] | number | number[] | boolean | boolean[]>;
}
