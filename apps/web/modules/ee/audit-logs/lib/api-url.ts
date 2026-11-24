/**
 * Query parameters an audit event may keep. Everything else a caller put in the query string (filter
 * values, emails, ids, a secret passed by mistake) is dropped, whatever its name (ENG-3269).
 * `createdFrom` records where a v3-created survey came from (`ZV3CreateSurveyQuery`).
 */
const ALLOWED_QUERY_PARAMS = new Set(["createdFrom"]);

/**
 * The allowlisted parameters are short slugs; a value that is not one is dropped rather than kept. A
 * shape, not `V3_SURVEY_CREATED_FROM` itself, so the audit builder does not import the v3 survey schemas.
 */
const ALLOWED_QUERY_VALUE = /^[a-z0-9-]{1,32}$/;

/**
 * The file delete route is `/storage/<workspaceId>/<accessType>/<...filePath>`, and the file path ends
 * in the name the uploader chose. The workspace and access type identify the route; the name stays out.
 */
const STORAGE_FILE_PATH = /^(\/storage\/[^/]+\/[^/]+)\/.+$/;

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

  const kept = new URLSearchParams();
  for (const [name, value] of url.searchParams) {
    if (ALLOWED_QUERY_PARAMS.has(name) && ALLOWED_QUERY_VALUE.test(value)) kept.append(name, value);
  }

  const pathname = url.pathname.replace(STORAGE_FILE_PATH, "$1/redacted");
  const search = kept.size > 0 ? `?${kept.toString()}` : "";
  return `${url.origin}${pathname}${search}`;
};
