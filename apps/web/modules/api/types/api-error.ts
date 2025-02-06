export interface ApiErrorResponse {
  code:
  | "not_found"
  | "gone"
  | "bad_request"
  | "internal_server_error"
  | "unauthorized"
  | "method_not_allowed"
  | "not_authenticated"
  | "forbidden"
  | "too_many_requests";
  message: string;
  details: {
    [key: string]: string | string[] | number | number[] | boolean | boolean[];
  };
}
