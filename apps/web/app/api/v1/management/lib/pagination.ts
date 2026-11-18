import { ValidationError } from "@formbricks/types/errors";

/** Largest offset Prisma accepts (Int32); anything above is clamped rather than reaching the database. */
const MAX_OFFSET = 2_147_483_647;

/** Hard ceiling on rows a single v1 management list request returns (v2 uses the same bound). */
export const V1_MANAGEMENT_MAX_LIMIT = 250;

type TV1PaginationOptions = {
  /** Query parameter carrying the number of rows to skip. v1 spells it `skip` on responses, `offset` on surveys. */
  offsetParam?: string;
  /** Page size when `limit` is absent or unusable. Defaults to the ceiling. */
  defaultLimit?: number;
};

const parseInteger = (raw: string | null): number | null => {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : null;
};

/**
 * Reads `limit` and the offset parameter from a v1 management list request. The result always bounds the
 * query: a missing, non-numeric or non-positive `limit` falls back to `defaultLimit`, and a missing or
 * negative offset is 0.
 *
 * A `limit` above {@link V1_MANAGEMENT_MAX_LIMIT} throws a {@link ValidationError} (400 through
 * `handleApiError`) instead of being clamped: a client that pages until a page comes back shorter than the
 * `limit` it asked for would read a clamped page as the last one and silently lose every row after it.
 */
export const parseV1Pagination = (
  searchParams: URLSearchParams,
  { offsetParam = "skip", defaultLimit = V1_MANAGEMENT_MAX_LIMIT }: TV1PaginationOptions = {}
): { limit: number; offset: number } => {
  const rawLimit = searchParams.get("limit");
  const requestedLimit = parseInteger(rawLimit);
  // `Number("Infinity")` is not finite, so parseInteger drops it; it is still a limit above the ceiling.
  const exceedsCeiling =
    requestedLimit === null ? Number(rawLimit) === Infinity : requestedLimit > V1_MANAGEMENT_MAX_LIMIT;
  if (exceedsCeiling) {
    throw new ValidationError(`limit must not exceed ${V1_MANAGEMENT_MAX_LIMIT}`);
  }
  const limit =
    requestedLimit === null || requestedLimit < 1
      ? Math.min(defaultLimit, V1_MANAGEMENT_MAX_LIMIT)
      : requestedLimit;

  const requestedOffset = parseInteger(searchParams.get(offsetParam));
  const offset = requestedOffset === null ? 0 : Math.min(Math.max(0, requestedOffset), MAX_OFFSET);

  return { limit, offset };
};
