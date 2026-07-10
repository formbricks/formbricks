import { PrismaErrorType } from "../types/error";
import { Prisma } from "./prisma";
import type { PrismaClientKnownRequestError } from "./prisma";

/**
 * Type guard for Prisma "known request" errors, optionally narrowed to a specific error code.
 * Returns a type predicate so callers can read `error.code`/`error.meta` after the check.
 *
 * Note: the predicate uses the named `PrismaClientKnownRequestError` type (not the namespaced
 * `Prisma.PrismaClientKnownRequestError`, which resolves to `any` in type position and would
 * collapse the negative branch of the guard to `never`).
 */
export const isPrismaKnownRequestError = (
  error: unknown,
  code?: PrismaErrorType
): error is PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (code === undefined || error.code === (code as string));

/** Type guard for a Prisma unique-constraint violation (P2002). */
export const isUniqueConstraintError = (error: unknown): error is PrismaClientKnownRequestError =>
  isPrismaKnownRequestError(error, PrismaErrorType.UniqueConstraintViolation);

/** Type guard for a Prisma foreign-key-constraint violation (P2003). */
export const isForeignKeyConstraintError = (error: unknown): error is PrismaClientKnownRequestError =>
  isPrismaKnownRequestError(error, PrismaErrorType.ForeignKeyConstraintViolation);

// Recursively collect every string in a Prisma error `meta`. Prisma 7's driver adapters (this repo
// uses @prisma/adapter-pg) nest the real constraint name deep under
// `meta.driverAdapterError.cause` (constraint.index / originalMessage), so a shallow scan of
// `Object.values(meta)` would only see `modelName` and miss it — mis-mapping the violation.
const collectMetaStrings = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectMetaStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectMetaStrings);
  }
  return [];
};

/**
 * Returns true when the error's `meta` contains **all** of the given needles as substrings.
 *
 * The `meta` shape of Prisma errors (P2002 targets, P2003 constraint names, ...) varies by version
 * and driver adapter — Prisma 7 + `@prisma/adapter-pg` nests the constraint name deep under
 * `meta.driverAdapterError.cause` (`constraint.index` / `originalMessage`), while other shapes only
 * expose flat `field_name` columns. This deep-scans every string in `meta` so callers can match a
 * constraint by name (or by column set as a fallback) without hard-coding the nesting.
 */
export const prismaErrorMetaIncludes = (
  error: PrismaClientKnownRequestError,
  ...needles: string[]
): boolean => {
  const haystack = collectMetaStrings(error.meta).join(" ");
  return needles.every((needle) => haystack.includes(needle));
};
