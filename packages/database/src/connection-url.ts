/**
 * A PostgreSQL connection URL split around its query string. Only the query is parsed, so forms that
 * WHATWG `URL` rejects or rewrites (socket paths, empty hosts) survive a rewrite byte for byte.
 */
export interface TConnectionUrlParts {
  base: string;
  params: URLSearchParams;
  fragment: string;
}

export const splitConnectionUrl = (connectionUrl: string): TConnectionUrlParts => {
  const queryStart = connectionUrl.search(/[?#]/);
  if (queryStart === -1) {
    return { base: connectionUrl, params: new URLSearchParams(), fragment: "" };
  }

  const base = connectionUrl.slice(0, queryStart);
  const rest = connectionUrl.slice(queryStart);
  const fragmentStart = rest.indexOf("#");
  const query = fragmentStart === -1 ? rest : rest.slice(0, fragmentStart);
  const fragment = fragmentStart === -1 ? "" : rest.slice(fragmentStart);

  return { base, params: new URLSearchParams(query.replace(/^\?/, "")), fragment };
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
