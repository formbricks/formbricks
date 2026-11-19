import type { BetterAuthOptions } from "better-auth";

type TRateLimitStorage = NonNullable<NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]>;

/** The template every path that names no endpoint is counted under, one bucket per client (ENG-7399). */
export const UNMATCHED_AUTH_PATH_TEMPLATE = "/:unmatched";

// Empty segments are dropped, as the router matches `//sign-in//email` to `/sign-in/email`: counting such a
// request apart from the endpoint it reaches would hand it a second budget.
const segmentsOf = (path: string): string[] => path.split("/").filter((segment) => segment !== "");

/**
 * Maps a Better Auth request path (the part after `/api/auth`) to the endpoint template it names, from the
 * endpoints' own DECLARED paths: `/reset-password/abc` → `/reset-password/:token`. A path that names no
 * endpoint maps to {@link UNMATCHED_AUTH_PATH_TEMPLATE}. The result is always one of a fixed, small set, so it
 * can key a counter without letting the caller choose the key.
 *
 * Declared paths are read once; better-call stamps each endpoint function with its path, the same source
 * `better-auth-path-label.ts` reads. A `:name` segment matches any one segment, as in the router.
 */
export const createAuthPathTemplateMatcher = (
  declaredPaths: Iterable<unknown>
): ((path: string) => string) => {
  const literal = new Map<string, string>();
  const patterns: { template: string; segments: string[] }[] = [];

  for (const declared of declaredPaths) {
    if (typeof declared !== "string" || !declared.startsWith("/")) continue;
    const segments = segmentsOf(declared);
    if (segments.some((segment) => segment.startsWith(":"))) patterns.push({ template: declared, segments });
    else literal.set(segments.join("/"), declared);
  }

  return (path: string): string => {
    const segments = segmentsOf(path);
    const exact = literal.get(segments.join("/"));
    if (exact) return exact;

    const pattern = patterns.find(
      (candidate) =>
        candidate.segments.length === segments.length &&
        candidate.segments.every((segment, index) => segment.startsWith(":") || segment === segments[index])
    );
    return pattern ? pattern.template : UNMATCHED_AUTH_PATH_TEMPLATE;
  };
};

/**
 * Better Auth's rate-limit storage, counting each client per endpoint TEMPLATE rather than per raw path
 * (ENG-7399).
 *
 * Better Auth keys a counter on `<ip>|<path>`, with the path exactly as requested, and keeps it in Redis
 * for the rule's window. The limiter runs before routing, so every distinct path is its own counter: a
 * client sending `/api/auth/<16 KB of junk>`, or `/reset-password/<a fresh token>` each time, never reaches
 * its limit and leaves a 16 KB key per request. Keying on the template, the way rate limiters and metrics
 * key on the route rather than the URL, gives each client one small counter per endpoint and one for
 * everything unmatched. The rule (window, max) is still chosen by Better Auth from the request's path.
 *
 * The count itself is Better Auth's own `secondary-storage` consume, unchanged: one atomic increment that
 * sets the TTL to the window, allowed while the count is within `max`. A Redis failure propagates as it did.
 */
export const createTemplateKeyedRateLimitStorage = ({
  declaredPaths,
  increment,
  defaultWindowSeconds,
}: {
  /** Called once, on the first request: Better Auth's endpoints exist only once `betterAuth()` returns. */
  declaredPaths: () => Iterable<unknown>;
  increment: (key: string, ttlSeconds: number) => Promise<number>;
  defaultWindowSeconds: number;
}): TRateLimitStorage => {
  let templateOf: ((path: string) => string) | undefined;

  return {
    consume: async (key, rule) => {
      templateOf ??= createAuthPathTemplateMatcher(declaredPaths());
      // `createRateLimitKey` writes `${ip}|${path}`. An IP (or the `no-trusted-ip` fallback) has no `|`, so
      // the first one ends it; a `|` in the path cannot move the client part.
      const separator = key.indexOf("|");
      const client = separator === -1 ? key : key.slice(0, separator);
      const path = separator === -1 ? "" : key.slice(separator + 1);

      const window = rule.window ?? defaultWindowSeconds;
      const count = await increment(`${client}|${templateOf(path)}`, window);
      return count <= rule.max ? { allowed: true, retryAfter: null } : { allowed: false, retryAfter: window };
    },
  };
};
