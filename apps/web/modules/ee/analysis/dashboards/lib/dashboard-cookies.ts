/**
 * The cookies a dashboard page remembers a person's date range and filter picks in (C2). Each is scoped to
 * that dashboard's page path, so it travels only with requests for that dashboard rather than with every
 * request to the app: with `path=/`, every dashboard a person ever filtered added its cookies to every
 * request header, and enough of them push a request past the server's header limit.
 */

/**
 * The longest value one dashboard cookie holds. Browsers drop a cookie over 4 KB (name and attributes
 * included); a value that would not fit is not written, and the page keeps it in its URL only.
 */
export const MAX_DASHBOARD_COOKIE_VALUE_LENGTH = 3500;

const forget = (name: string, path: string): string => `${name}=; path=${path}; max-age=0; SameSite=Lax`;

/** A path a `Set-Cookie` path attribute can carry as it is: absolute, no separators, spaces or controls. */
const isCookiePath = (path: string): boolean =>
  path.startsWith("/") &&
  [...path].every((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code > 0x20 && code !== 0x7f && char !== ";" && char !== ",";
  });

/**
 * The `document.cookie` assignments that remember (or, for `null`, forget) one dashboard cookie, in order.
 * A copy an earlier version wrote on `path=/` is always expired. A value past
 * `MAX_DASHBOARD_COOKIE_VALUE_LENGTH` is forgotten rather than half-written, so a stale value never wins.
 */
export const dashboardCookieAssignments = ({
  name,
  value,
  path,
  maxAgeSeconds,
}: {
  name: string;
  value: string | null;
  path: string;
  maxAgeSeconds: number;
}): string[] => {
  const legacy = forget(name, "/");
  if (!isCookiePath(path) || path === "/") return [legacy];
  if (value === null || value === "" || value.length > MAX_DASHBOARD_COOKIE_VALUE_LENGTH) {
    return [forget(name, path), legacy];
  }
  return [`${name}=${value}; path=${path}; max-age=${maxAgeSeconds}; SameSite=Lax`, legacy];
};

/**
 * Remember (or forget) a dashboard cookie on the page currently shown — the dashboard's own page.
 * Client-only; a no-op on the server.
 */
export const writeDashboardCookie = (name: string, value: string | null, maxAgeSeconds: number): void => {
  if (typeof document === "undefined") return;
  for (const assignment of dashboardCookieAssignments({
    name,
    value,
    path: globalThis.location.pathname,
    maxAgeSeconds,
  })) {
    document.cookie = assignment;
  }
};
