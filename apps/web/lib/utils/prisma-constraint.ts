import { Prisma } from "@formbricks/database/prisma";
import type { PrismaClientKnownRequestError } from "@formbricks/database/prisma";

/** Prisma unique-constraint violation code. */
const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * Type guard for a Prisma P2002 unique-constraint violation.
 *
 * Matches on the stable `error.code`, never on `error.meta` (which is not public API — see
 * `getUniqueConstraintFields`). Uses the *named* `PrismaClientKnownRequestError` type for the
 * predicate so the negative branch of the guard doesn't collapse to `never`.
 */
export const isUniqueConstraintError = (error: unknown): error is PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION;

/**
 * Returns the column names involved in a P2002 unique-constraint violation.
 *
 * Prisma's `error.meta` shape is explicitly NOT public API (prisma#28953) and differs by engine:
 *  - library / legacy query engine: `meta.target` is a `string[]`
 *  - Prisma 7 + `@prisma/adapter-pg` (this repo): `meta.target` is absent; the columns live at
 *    `meta.driverAdapterError.cause.constraint.fields`
 *
 * We read both, in that order — this is the ONLY place in the codebase that touches the unstable
 * shape. Returns `[]` when neither is present (callers must still map P2002 to a conflict/domain
 * error, never a 500).
 *
 * Security: only the structured column names are returned. Never surface `originalMessage`, the
 * constraint name, or any other raw `driverAdapterError.cause` string to a response or log — the
 * underlying Postgres unique-violation detail can contain the offending value (PII).
 */
export const getUniqueConstraintFields = (error: PrismaClientKnownRequestError): string[] => {
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
      }
    | undefined;

  // Legacy / library-engine shape.
  const legacyTarget = meta?.target;
  if (Array.isArray(legacyTarget)) {
    return legacyTarget.filter((field): field is string => typeof field === "string");
  }

  // Prisma 7 driver-adapter shape.
  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) {
    return adapterFields.filter((field): field is string => typeof field === "string");
  }

  return [];
};
