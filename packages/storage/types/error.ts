export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

export interface ResultError<T> {
  ok: false;
  error: T;
}

export interface ResultOk<T> {
  ok: true;
  data: T;
}

export const ok = <T, E>(data: T): Result<T, E> => ({ ok: true, data });

export const okVoid = <E>(): Result<void, E> => ({ ok: true, data: undefined });

export const err = <E = Error>(error: E): ResultError<E> => ({
  ok: false,
  error,
});

export enum StorageErrorCode {
  Unknown = "unknown",
  S3CredentialsError = "s3_credentials_error",
  S3ClientError = "s3_client_error",
  FileNotFoundError = "file_not_found_error",
  InvalidInput = "invalid_input",
}

export interface StorageError {
  code: StorageErrorCode;
}
