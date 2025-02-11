export type ApiErrorDetails = { field: string; issue: string }[];

export type ApiErrorResponse =
  | {
      type: "unauthorized" | "forbidden" | "conflict" | "too_many_requests" | "internal_server_error";
      details?: ApiErrorDetails;
    }
  | {
      type: "bad_request" | "not_found" | "unprocessable_entity";
      details: ApiErrorDetails;
    };
