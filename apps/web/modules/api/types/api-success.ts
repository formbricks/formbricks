export interface ApiSuccessResponseWithData<T = { [key: string]: unknown }> {
  data: T;
}

export interface ApiSuccessResponseWithMeta<T = { [key: string]: unknown }>
  extends ApiSuccessResponseWithData<T> {
  meta: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export type ApiSuccessResponse<T = { [key: string]: unknown }> =
  | ApiSuccessResponseWithData<T>
  | ApiSuccessResponseWithMeta<T>;
