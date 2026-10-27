import type { NextConfig } from "next";
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

describe("CSP lets Sentry Replay start its blob: worker (ENG-3194)", () => {
  beforeAll(async () => {
    for (const [name, value] of Object.entries(REQUIRED_ENV)) {
      vi.stubEnv(name, value);
    }
    nextConfig = (await import("../next.config.mjs")).default;
  }, 30_000);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  test.each(["production", "development"])("every CSP allows blob: workers in %s", async (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);

    const rules = (await nextConfig.headers?.()) ?? [];
    const policies = rules.flatMap((rule) =>
      rule.headers
        .filter((header) => header.key === "Content-Security-Policy")
        .map((header) => ({ source: rule.source, workerSources: getWorkerSources(header.value) }))
    );

    // The app routes and the embeddable /s/ and /c/ survey routes each set their own CSP.
    expect(policies.length).toBeGreaterThanOrEqual(2);
    for (const { source, workerSources } of policies) {
      expect(workerSources, `CSP for ${source}`).toEqual(expect.arrayContaining(["'self'", "blob:"]));
    }
  });
});
