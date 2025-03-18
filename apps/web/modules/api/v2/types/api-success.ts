export interface ApiResponse<T = { [key: string]: unknown }> {
  data: T;
}

export interface ApiResponseWithMeta<T = { [key: string]: unknown }> extends ApiResponse<T> {
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export type ApiSuccessResponse<T = { [key: string]: unknown }> = ApiResponse<T> | ApiResponseWithMeta<T>;
