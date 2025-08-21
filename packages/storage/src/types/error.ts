export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

export interface ResultError<T> {
  ok: false;
  error: T;
}

export interface ResultOk<T> {
  ok: true;
  value: T;
}

export const ok = <T, E>(data: T): Result<T, E> => ({ ok: true, data });

export const okVoid = <E>(): Result<void, E> => ({ ok: true, data: undefined });

export const err = <E = Error>(error: E): ResultError<E> => ({
  ok: false,
  error,
});

export interface UnknownError {
  code: "unknown";
  message: string;
}

export interface S3CredentialsError {
  code: "s3_credentials_error";
  message: string;
}

export interface S3ClientError {
  code: "s3_client_error";
  message: string;
}
