export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

export const ok = <T, E>(data: T): Result<T, E> => ({ ok: true, data });

export const okVoid = <E>(): Result<void, E> => ({ ok: true, data: undefined });

export const err = <E = Error>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
