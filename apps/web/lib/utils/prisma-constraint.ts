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
 * Strips one symmetric pair of double quotes from a column name.
 *
 * `@prisma/adapter-pg` derives the column list by regex-scraping the Postgres error DETAIL
 * (`Key ("surveyId", "singleUseId")=(…)`) and never unquotes it. Postgres quotes any identifier
 * `quote_identifier()` does not consider safe to leave bare — not all-lowercase, starting with a
 * digit, containing anything outside `[a-z0-9_]`, or colliding with a keyword — so `singleUseId`
 * arrives as `"singleUseId"` while `token_hash` arrives bare. (`quote_all_identifiers = on` quotes
 * everything, which this also handles.)
 *
 * Only a matched outer pair is removed, so already-bare names pass through byte-identical. Applied
 * to the legacy `meta.target` shape too: that engine does not quote, but running both branches
 * through the same normaliser keeps the two interchangeable for callers and tests.
 */
const unquoteIdentifier = (field: string): string =>
  field.length >= 2 && field.startsWith('"') && field.endsWith('"') ? field.slice(1, -1) : field;

const toColumnNames = (fields: unknown[]): string[] =>
  fields.filter((field): field is string => typeof field === "string").map(unquoteIdentifier);

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
 * underlying Postgres unique-violation detail can contain the offending value (PII). Stripping the
 * quotes below is deliberately the *only* string processing done here, for the same reason.
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
    return toColumnNames(legacyTarget);
  }

  // Prisma 7 driver-adapter shape.
  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) {
    return toColumnNames(adapterFields);
  }

  return [];
};
