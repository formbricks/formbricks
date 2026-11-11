import type { NextConfig } from "next";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// Guards ENG-3194. Sentry Session Replay compresses recordings in a `blob:` worker. Without an
// explicit `worker-src`, browsers fall back to `script-src`, which has no `blob:`, so the worker is
// blocked on every page and a console error is the only sign. Asserted on the `headers()` output
// rather than the source, so every rule that sets a CSP is covered, including any added later.

// next.config.mjs validates the app env when it is imported. These are the vars with no default; CI
// blanks REDIS_URL in its .env, so they are stubbed rather than read from the environment.
const REQUIRED_ENV = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/formbricks",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
  CUBEJS_API_SECRET: "test-cubejs-secret",
  CUBEJS_API_URL: "http://localhost:4000",
  HUB_API_URL: "http://localhost:8080",
  HUB_API_KEY: "test-hub-key",
  REDIS_URL: "redis://localhost:6379",
};

let nextConfig: NextConfig;

const getWorkerSources = (csp: string): string[] | undefined => {
  const directive = csp
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([name]) => name === "worker-src");
  return directive?.slice(1);
};

// A bare `sandbox` (no `allow-scripts`) runs no script at all, so it needs no worker either.
const isScriptless = (csp: string): boolean => csp.split(";").some((part) => part.trim() === "sandbox");

beforeAll(async () => {
  for (const [name, value] of Object.entries(REQUIRED_ENV)) {
    vi.stubEnv(name, value);
  }
  nextConfig = (await import("../next.config.mjs")).default;
}, 30_000);

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("CSP lets Sentry Replay start its blob: worker (ENG-3194)", () => {
  test.each(["production", "development"])("every CSP allows blob: workers in %s", async (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);

    const rules = (await nextConfig.headers?.()) ?? [];
    const policies = rules.flatMap((rule) =>
      rule.headers
        .filter((header) => header.key === "Content-Security-Policy" && !isScriptless(header.value))
        .map((header) => ({ source: rule.source, workerSources: getWorkerSources(header.value) }))
    );

    // The app routes and the embeddable /s/ and /c/ survey routes each set their own CSP.
    expect(policies.length).toBeGreaterThanOrEqual(2);
    for (const { source, workerSources } of policies) {
      expect(workerSources, `CSP for ${source}`).toEqual(expect.arrayContaining(["'self'", "blob:"]));
    }
  });
});

// Guards ENG-7108. A route handler cannot set its own CSP (the config's replaces it), so the policy for
// uploaded files lives in the config, and the last matching rule wins, as it does in Next.
describe("CSP for uploaded files (ENG-7108)", () => {
  const effectiveCsp = async (pathname: string): Promise<string | undefined> => {
    const rules = (await nextConfig.headers?.()) ?? [];
    let csp: string | undefined;
    for (const rule of rules) {
      const matches = getPathMatch(rule.source, {
        strict: true,
        removeUnnamedParams: true,
        sensitive: false,
      });
      const header = rule.headers.find((h) => h.key === "Content-Security-Policy");
      if (header && matches(pathname) !== false) csp = header.value;
    }
    return csp;
  };

  test.each([
    "/storage/ws1/public/photo--fid--1.png",
    "/storage/ws1/private/surveys/s1/elements/e1/evil--fid--1.png",
    "/storage/ws1/private/notes--fid--1.txt",
    "/storage/ws1/private/report.pdf.png",
  ])("sandboxes %s", async (pathname) => {
    expect(await effectiveCsp(pathname)).toBe("default-src 'none'; frame-ancestors 'self'; sandbox");
  });

  test.each(["/storage/ws1/private/report--fid--1.pdf", "/storage/ws1/private/report--fid--1.PDF"])(
    "leaves %s on the app policy so the browser's PDF viewer still opens it",
    async (pathname) => {
      const csp = await effectiveCsp(pathname);
      expect(csp).toBeDefined();
      expect(isScriptless(csp ?? "")).toBe(false);
    }
  );

  test("does not touch app pages", async () => {
    expect(isScriptless((await effectiveCsp("/workspaces/ws1/surveys")) ?? "")).toBe(false);
  });
});
