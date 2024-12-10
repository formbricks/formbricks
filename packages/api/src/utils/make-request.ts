import { type Result, err, ok, wrapThrowsAsync } from "@formbricks/types/error-handlers";
import { type ForbiddenError, type NetworkError } from "@formbricks/types/errors";
import type { ApiErrorResponse, ApiResponse, ApiSuccessResponse } from "../types";

export const makeRequest = async <T>(
  apiHost: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  data?: unknown
): Promise<Result<T, NetworkError | Error | ForbiddenError>> => {
  const url = new URL(apiHost + endpoint);
  const body = data ? JSON.stringify(data) : undefined;

  const res = await wrapThrowsAsync(fetch)(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) return err(res.error);

  const response = res.data;
  const json = (await response.json()) as ApiResponse;

  if (!response.ok) {
    const errorResponse = json as ApiErrorResponse;
    return err({
      code: errorResponse.code === "forbidden" ? "forbidden" : "network_error",
      status: response.status,
      message: errorResponse.message || "Something went wrong",
      url,
      ...(Object.keys(errorResponse.details).length > 0 && { details: errorResponse.details }),
    });
  }

  const successResponse = json as ApiSuccessResponse<T>;
  return ok(successResponse.data);
};
