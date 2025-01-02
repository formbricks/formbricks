import { type Result, err, ok, wrapThrowsAsync } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { type ApiResponse, type ApiSuccessResponse } from "../types";

export const makeRequest = async <T>(
  apiHost: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  data?: unknown
): Promise<Result<T, ApiErrorResponse>> => {
  const url = new URL(apiHost + endpoint);
  const body = data ? JSON.stringify(data) : undefined;

  const res = await wrapThrowsAsync(fetch)(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  // TODO: Only return api error response relevant keys
  if (!res.ok) return err(res.error as unknown as ApiErrorResponse);

  const response = res.data;
  const json = (await response.json()) as ApiResponse;

  if (!response.ok) {
    const errorResponse = json as ApiErrorResponse;
    return err({
      code: errorResponse.code === "forbidden" ? "forbidden" : "network_error",
      status: response.status,
      message: errorResponse.message || "Something went wrong",
      url,
      ...(Object.keys(errorResponse.details ?? {}).length > 0 && { details: errorResponse.details }),
    });
  }

  const successResponse = json as ApiSuccessResponse<T>;
  return ok(successResponse.data);
};
