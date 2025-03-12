import { type ApiErrorResponse } from "@formbricks/types/errors";

export interface ApiConfig {
  environmentId: string;
  appUrl: string;
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

export interface ApiSuccessResponse<T = Record<string, unknown>> {
  data: T;
}
