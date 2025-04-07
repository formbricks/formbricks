import { wrapThrowsAsync } from "@/lib/common/utils";
import { ApiResponse, ApiSuccessResponse } from "@/types/api";
import { TEnvironmentState } from "@/types/config";
import { ApiErrorResponse, Result, err, ok } from "@/types/error";

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
    },
    ...(isDebug && { "Cache-Control": "no-cache" }),
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

// Simple API client using fetch
export class ApiClient {
  private appUrl: string;
  private environmentId: string;
  private isDebug: boolean;

  constructor({
    appUrl,
    environmentId,
    isDebug = false,
  }: {
    appUrl: string;
    environmentId: string;
    isDebug: boolean;
  }) {
    this.appUrl = appUrl;
    this.environmentId = environmentId;
    this.isDebug = isDebug;
  }

  async createOrUpdateUser(userUpdateInput: { userId: string; attributes?: Record<string, string> }): Promise<
    Result<
      {
        state: {
          expiresAt: Date | null;
          data: {
            userId: string | null;
            contactId: string | null;
            segments: string[];
            displays: { surveyId: string; createdAt: Date }[];
            responses: string[];
            lastDisplayAt: Date | null;
            language?: string;
          };
        };
        messages?: string[];
      },
      ApiErrorResponse
    >
  > {
    // transform all attributes to string if attributes are present into a new attributes copy
    const attributes: Record<string, string> = {};
    for (const key in userUpdateInput.attributes) {
      attributes[key] = String(userUpdateInput.attributes[key]);
    }

    return makeRequest(
      this.appUrl,
      `/api/v2/client/${this.environmentId}/user`,
      "POST",
      {
        userId: userUpdateInput.userId,
        attributes,
      },
      this.isDebug
    );
  }

  async getEnvironmentState(): Promise<Result<TEnvironmentState, ApiErrorResponse>> {
    return makeRequest(
      this.appUrl,
      `/api/v1/client/${this.environmentId}/environment`,
      "GET",
      undefined,
      this.isDebug
    );
  }
}
