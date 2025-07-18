import { type TUserState } from "@/types/config";
import { type ApiErrorResponse } from "@/types/error";

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

export interface ApiSuccessResponse<T = Record<string, unknown>> {
  data: T;
}

export interface CreateOrUpdateUserResponse {
  state: TUserState;
  messages?: string[];
}
