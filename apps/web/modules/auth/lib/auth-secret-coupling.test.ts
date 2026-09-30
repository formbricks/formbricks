import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Guards the coupling between Better Auth's signing secret and the two places that have to verify what
 * it signs. Same shape as lib/turbo-build-env.test.ts: a source-level assertion, because the behaviour
 * lives in which expression is passed to `betterAuth()` and nothing cheaper can fail on it.
 *
 * Why it exists: `auth.ts` signs session cookies, `session-cookie.ts` verifies them for the forward-auth
 * proxy, and `jwt.ts` signs every invite, verification, email-change and PIN token. If any two of them
 * resolve the secret differently the proxy rejects every session and bounces users between / and
 * /auth/login — the ENG-1054 regression. Before ENG-2599 that pairing was pinned by precedence tests in
 * session-cookie.test.ts; those moved to lib/constants.test.ts when the chain was centralized, and
 * mocking `AUTH_SECRET` in each consumer cannot detect one consumer wandering off it.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath: string): string => fs.readFileSync(path.resolve(here, relativePath), "utf8");

const RESOLVED_SECRET_CONSUMERS = [
  ["auth.ts", "./auth.ts"],
  ["session-cookie.ts", "./session-cookie.ts"],
  ["signup-intent.ts", "./signup-intent.ts"],
  ["jwt.ts", "../../../lib/jwt.ts"],
  ["pin-token.ts", "../../survey/link/lib/pin-token.ts"],
] as const;

describe("auth secret coupling", () => {
  test.each(RESOLVED_SECRET_CONSUMERS)(
    "%s takes the secret from the resolved constant, not the raw env vars",
    (_label, relativePath) => {
      const source = read(relativePath);

      expect(source).toMatch(/AUTH_SECRET/);
      // The whole point of the centralization: no consumer re-derives the alias for itself.
      expect(source).not.toMatch(/env\.BETTER_AUTH_SECRET/);
      expect(source).not.toMatch(/env\.NEXTAUTH_SECRET/);
    }
  );

  test("auth.ts hands Better Auth the resolved secret, base URL and trusted origins", () => {
    const source = read("./auth.ts");

    // Anchored on the option names so replacing any of them with a literal, or reverting one to a raw
    // env read, fails here rather than in production.
    expect(source).toMatch(/^\s*secret: AUTH_SECRET,$/m);
    expect(source).toMatch(/^\s*baseURL: AUTH_URL,$/m);
    expect(source).toMatch(/^\s*trustedOrigins: AUTH_TRUSTED_ORIGINS,$/m);
  });

  test("the URL consumers keep their own WEBAPP_URL tail rather than folding it into AUTH_URL", () => {
    // AUTH_URL is deliberately the two-element resolution. These two append WEBAPP_URL themselves
    // because that tail is their own precedence — auth.ts must NOT get it, or a misconfigured instance
    // silently signs cookies for the wrong origin instead of failing.
    for (const relativePath of ["./oauth-urls.ts", "./auth-cookies.ts"]) {
      expect(read(relativePath)).toMatch(/AUTH_URL \?\? env\.WEBAPP_URL/);
    }
  });
});
