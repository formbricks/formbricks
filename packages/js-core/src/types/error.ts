export interface ResultError<T> {
  ok: false;
  error: T;
}

export interface ResultOk<T> {
  ok: true;
  value: T;
}

export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

export const ok = <T, E>(data: T): Result<T, E> => ({ ok: true, data });

export const okVoid = <E>(): Result<void, E> => ({ ok: true, data: undefined });

export const err = <E = Error>(error: E): ResultError<E> => ({
  ok: false,
  error,
});

export const match = <TSuccess, TError, TReturn>(
  result: Result<TSuccess, TError>,
  onSuccess: (value: TSuccess) => TReturn,
  onError: (error: TError) => TReturn
): TReturn => (result.ok ? onSuccess(result.data) : onError(result.error));

export interface ApiErrorResponse {
  code:
    | "not_found"
    | "gone"
    | "bad_request"
    | "internal_server_error"
    | "unauthorized"
    | "method_not_allowed"
    | "not_authenticated"
    | "forbidden"
    | "network_error"
    | "too_many_requests";
  message: string;
  status: number;
  url?: URL;
  details?: Record<string, string | string[] | number | number[] | boolean | boolean[]>;
  responseMessage?: string;
}

export interface MissingFieldError {
  code: "missing_field";
  field: string;
}

export interface MissingPersonError {
  code: "missing_person";
  message: string;
}

export interface NetworkError {
  code: "network_error";
  status: number;
  message: string;
  url: URL;
  responseMessage: string;
}
export interface NotSetupError {
  code: "not_setup";
  message: string;
}

export interface InvalidCodeError {
  code: "invalid_code";
  message: string;
}
