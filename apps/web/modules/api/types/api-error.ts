export interface ApiErrorResponse {
  type:
    | "bad_request"
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "conflict"
    | "unprocessable_entity"
    | "too_many_requests"
    | "internal_server_error"
    | "not_authenticated";
  message: string;
  details: {
    [key: string]: string | string[] | number | number[] | boolean | boolean[];
  };
}
