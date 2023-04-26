export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T, E>(value: T): Result<T, E> => ({ ok: true, value });

export const okVoid = <E>(): Result<void, E> => ({ ok: true, value: undefined });

export const err = <E = Error>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
