export interface ApiSuccessResponse<T = { [key: string]: unknown }> {
  data: T;
  metadata?: {
    [key: string]: unknown;
  };
}
