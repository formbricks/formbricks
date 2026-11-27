/**
 * A PostgreSQL connection URL split around its query string. Only the query is parsed, so forms that
 * WHATWG `URL` rejects or rewrites (socket paths, empty hosts) survive a rewrite byte for byte.
 */
export interface TConnectionUrlParts {
  base: string;
  params: URLSearchParams;
  fragment: string;
}

/** The URL's query string as written, without the leading "?" and the fragment. */
export const rawQueryString = (connectionUrl: string): string => splitRaw(connectionUrl).query;

const splitRaw = (connectionUrl: string): { base: string; query: string; fragment: string } => {
  const queryStart = connectionUrl.search(/[?#]/);
  if (queryStart === -1) {
    return { base: connectionUrl, query: "", fragment: "" };
  }

  const base = connectionUrl.slice(0, queryStart);
  const rest = connectionUrl.slice(queryStart);
  const fragmentStart = rest.indexOf("#");
  const query = fragmentStart === -1 ? rest : rest.slice(0, fragmentStart);
  const fragment = fragmentStart === -1 ? "" : rest.slice(fragmentStart);

  return { base, query: query.replace(/^\?/, ""), fragment };
};

export const splitConnectionUrl = (connectionUrl: string): TConnectionUrlParts => {
  const { base, query, fragment } = splitRaw(connectionUrl);
  return { base, params: new URLSearchParams(query), fragment };
};

export const joinConnectionUrl = ({ base, params, fragment }: TConnectionUrlParts): string => {
  const query = params.toString();
  const queryString = query ? "?" + query : "";
  return `${base}${queryString}${fragment}`;
};

/** A repeated query parameter's last value, which is the one pg and Prisma both use. */
export const lastParam = (params: URLSearchParams, name: string): string | null => {
  return params.getAll(name).pop() ?? null;
};

/** Whether a repeated query parameter holds different values, so reading only the last one hides a conflict. */
export const hasConflictingValues = (params: URLSearchParams, name: string): boolean =>
  new Set(params.getAll(name)).size > 1;

/** Why a URL that repeats sslaccept with different values is refused, by the app and by the migrations alike. */
export const SSLACCEPT_CONFLICT_MESSAGE =
  "The database URL sets sslaccept more than once with different values; keep only one.";
