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
 * query: a missing, non-numeric or non-positive `limit` falls back to `defaultLimit`, anything above
 * {@link V1_MANAGEMENT_MAX_LIMIT} is clamped to it, and a missing or negative offset is 0.
 */
export const parseV1Pagination = (
  searchParams: URLSearchParams,
  { offsetParam = "skip", defaultLimit = V1_MANAGEMENT_MAX_LIMIT }: TV1PaginationOptions = {}
): { limit: number; offset: number } => {
  const requestedLimit = parseInteger(searchParams.get("limit"));
  const limit =
    requestedLimit === null || requestedLimit < 1
      ? Math.min(defaultLimit, V1_MANAGEMENT_MAX_LIMIT)
      : Math.min(requestedLimit, V1_MANAGEMENT_MAX_LIMIT);

  const requestedOffset = parseInteger(searchParams.get(offsetParam));
  const offset = requestedOffset === null ? 0 : Math.min(Math.max(0, requestedOffset), MAX_OFFSET);

  return { limit, offset };
};
