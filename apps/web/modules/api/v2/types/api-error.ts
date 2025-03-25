import { ZodCustomIssue } from "zod";

export type ApiErrorDetails = { field: string; issue: string; params?: ZodCustomIssue["params"] }[];

export type ApiErrorResponseV2 =
  | {
      type: "unauthorized" | "forbidden" | "conflict" | "too_many_requests" | "internal_server_error";
      details?: ApiErrorDetails;
    }
  | {
      type: "bad_request" | "not_found" | "unprocessable_entity";
      details: ApiErrorDetails;
    };
