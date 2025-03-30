// We're naming the "params" field from zod (or otherwise) to "meta" since "params" is a bit confusing
// We're still using the "params" type from zod though because it allows us to not reference `any` and directly use the zod types
export type ApiErrorDetails = {
  field: string;
  issue: string;
  meta?: {
    [k: string]: unknown;
  };
}[];

export type ApiErrorResponseV2 =
  | {
      type: "unauthorized" | "forbidden" | "conflict" | "too_many_requests" | "internal_server_error";
      details?: ApiErrorDetails;
    }
  | {
      type: "bad_request" | "not_found" | "unprocessable_entity";
      details: ApiErrorDetails;
    };
