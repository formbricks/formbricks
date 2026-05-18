import { wrapThrowsAsync } from "@/lib/common/utils";
import { type ApiResponse, type ApiSuccessResponse, type CreateOrUpdateUserResponse } from "@/types/api";
import { type TWorkspaceState } from "@/types/config";
import { type ApiErrorResponse, type Result, err, ok } from "@/types/error";

export const makeRequest = async <T>(
  appUrl: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  data?: unknown,
  isDebug = false
): Promise<Result<T, ApiErrorResponse>> => {
  const url = new URL(appUrl + endpoint);
  const body = data ? JSON.stringify(data) : undefined;
  const res = await wrapThrowsAsync(fetch)(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(isDebug && { "Cache-Control": "no-cache" }),
    },
    body,
  });

  if (!res.ok) {
    return err({
      code: "network_error",
      status: 500,
      message: "Something went wrong",
    });
  }

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

// Simple API client using fetch
export class ApiClient {
  private appUrl: string;
  private workspaceId: string;
  private isDebug: boolean;

  constructor({
    appUrl,
    workspaceId,
    isDebug = false,
  }: {
    appUrl: string;
    workspaceId: string;
    isDebug: boolean;
  }) {
    this.appUrl = appUrl;
    this.workspaceId = workspaceId;
    this.isDebug = isDebug;
  }

  async createOrUpdateUser(userUpdateInput: {
    userId: string;
    attributes?: Record<string, string | number>;
  }): Promise<Result<CreateOrUpdateUserResponse, ApiErrorResponse>> {
    // Pass attributes as-is to preserve number types
    // The backend will use the JS type to determine the attribute data type
    return makeRequest(
      this.appUrl,
      `/api/v2/client/${this.workspaceId}/user`,
      "POST",
      {
        userId: userUpdateInput.userId,
        attributes: userUpdateInput.attributes,
      },
      this.isDebug
    );
  }

  async getWorkspaceState(): Promise<Result<TWorkspaceState, ApiErrorResponse>> {
    return makeRequest(
      this.appUrl,
      `/api/v1/client/${this.workspaceId}/environment`,
      "GET",
      undefined,
      this.isDebug
    );
  }
}
