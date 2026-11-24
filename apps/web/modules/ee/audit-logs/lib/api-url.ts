/**
 * The one query parameter an audit event keeps: `createdFrom` on `/api/v3/surveys` (behind `BASE_PATH` on
 * a sub-path deployment), which records where a created survey came from. Only the values that route's
 * query schema accepts are kept. Every other parameter, on every route, is dropped whatever its name or
 * value (ENG-3269). Listed here rather than imported, so the audit builder does not load the v3 survey
 * schemas; `api-url.test.ts` keeps the list equal to `V3_SURVEY_CREATED_FROM`.
 */
const CREATED_FROM_ROUTE_SUFFIX = "/api/v3/surveys";
export const AUDIT_CREATED_FROM_VALUES: ReadonlySet<string> = new Set([
  "blank",
  "template",
  "xm-template",
  "ai",
  "import",
]);

const keepAllowedQuery = (url: URL): URLSearchParams => {
  const kept = new URLSearchParams();
  if (!url.pathname.endsWith(CREATED_FROM_ROUTE_SUFFIX)) return kept;
  const createdFrom = url.searchParams.get("createdFrom");
  if (createdFrom !== null && AUDIT_CREATED_FROM_VALUES.has(createdFrom))
    kept.set("createdFrom", createdFrom);
  return kept;
};

/**
 * The file delete route is `/storage/<workspaceId>/<accessType>/<...filePath>`, behind `BASE_PATH` on a
 * sub-path deployment, and the file path ends in the name the uploader chose. The workspace and access
 * type identify the route; the name stays out.
 */
const redactStorageFilePath = (pathname: string): string => {
  const segments = pathname.split("/");
  const storageIndex = segments.indexOf("storage");
  const firstFileSegment = storageIndex + 3;
  if (storageIndex === -1 || segments.length <= firstFileSegment) return pathname;
  return [...segments.slice(0, firstFileSegment), "redacted"].join("/");
};

/**
 * The request URL as an audit event stores it: origin and path, plus only the allowlisted query
 * parameters. Returns undefined for a value that is not an absolute http(s) URL, since the audit schema
 * would otherwise reject the whole event.
 */
export const sanitizeAuditApiUrl = (apiUrl: string | undefined): string | undefined => {
  if (!apiUrl) return undefined;

  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch (error) {
    // `new URL` throws a TypeError for a relative or malformed value; anything else is unexpected.
    if (error instanceof TypeError) return undefined;
    throw error;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;

  const kept = keepAllowedQuery(url);

  const pathname = redactStorageFilePath(url.pathname);
  const search = kept.size > 0 ? `?${kept.toString()}` : "";
  return `${url.origin}${pathname}${search}`;
};
