import type { BetterAuthOptions } from "better-auth";
import { createHash } from "node:crypto";

type TRateLimitStorage = NonNullable<NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]>;

// Better Auth's own fallback window, in seconds, when a rule sets none.
const BETTER_AUTH_DEFAULT_WINDOW_SECONDS = 10;

/** The template every path that names no endpoint is counted under, one bucket per client (ENG-7399). */
export const UNMATCHED_AUTH_PATH_TEMPLATE = "/:unmatched";

// Segments after the leading `/`, empty ones kept: better-call answers 404 to any path with `//`, so such a
// path names no endpoint and must not share one's counter (Better Auth would give it another rule).
const segmentsOf = (path: string): string[] => path.split("/").slice(1);

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
    else literal.set(declared, declared);
  }

  return (path: string): string => {
    const exact = literal.get(path);
    if (exact) return exact;

    const segments = segmentsOf(path);
    const pattern = patterns.find(
      (candidate) =>
        candidate.segments.length === segments.length &&
        candidate.segments.every((segment, index) =>
          // A parameter matches one non-empty segment, as in the router.
          segment.startsWith(":") ? segments[index] !== "" : segment === segments[index]
        )
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
 * The window is part of the key: the counter's TTL is set when it is created, so a request Better Auth gives
 * a shorter window must not land on, and so expire, the counter of a longer one.
 *
 * The count itself is Better Auth's own `secondary-storage` consume, unchanged: one atomic increment that
 * sets the TTL to the window, allowed while the count is within `max`. A Redis failure propagates as it did.
 */
export const createTemplateKeyedRateLimitStorage = ({
  declaredPaths,
  increment,
}: {
  /**
   * Called once, on the limiter's first request. Better Auth runs the limiter in its HTTP router only, so
   * that is always after `betterAuth()` has returned and its endpoint registry exists.
   */
  declaredPaths: () => Iterable<unknown>;
  increment: (key: string, ttlSeconds: number) => Promise<number>;
}): TRateLimitStorage => {
  let templateOf: ((path: string) => string) | undefined;
  const getTemplateOf = (): ((path: string) => string) => {
    if (templateOf) return templateOf;
    const paths = [...declaredPaths()];
    const matcher = createAuthPathTemplateMatcher(paths);
    // An empty registry would send every request to the unmatched bucket; don't keep that, read it again.
    if (paths.length > 0) templateOf = matcher;
    return matcher;
  };

  return {
    consume: async (key, rule) => {
      // `createRateLimitKey` writes `${ip}|${path}`. An IP (or the `no-trusted-ip` fallback) has no `|`, so
      // the first one ends it; a `|` in the path cannot move the client part. A key in any other shape (a
      // Better Auth upgrade) is hashed rather than stored as is, so it can never be caller-sized.
      const separator = key.indexOf("|");
      const counterKey =
        separator === -1
          ? `sha256:${createHash("sha256").update(key).digest("base64url")}`
          : `${key.slice(0, separator)}|${getTemplateOf()(key.slice(separator + 1))}`;

      // Better Auth always passes a window today; a rule without one must not reach EXPIRE as "undefined",
      // which would leave the counter with no TTL and lock the client out for good.
      const window = rule.window > 0 ? rule.window : BETTER_AUTH_DEFAULT_WINDOW_SECONDS;
      const count = await increment(`${counterKey}|${window}`, window);
      return count <= rule.max ? { allowed: true, retryAfter: null } : { allowed: false, retryAfter: window };
    },
  };
};
