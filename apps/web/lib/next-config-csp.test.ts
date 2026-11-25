import type { NextConfig } from "next";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { mimeTypes } from "@formbricks/types/storage";

// Pages get their CSP from proxy.ts (lib/csp/content-security-policy.ts, whose tests guard ENG-3194's
// `worker-src`); next.config.mjs keeps only the policies of uploaded files and of the asset paths the
// proxy skips. The file also guards other security headers from the `headers()` output: framing
// (ENG-7395) and the absence of a wildcard CORS header on favicons, which scanners flag as a
// cross-domain misconfiguration.

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

// A policy that runs no script at all, as the uploaded-file ones do: a bare `sandbox` (no
// `allow-scripts`), or `default-src 'none'` with no `script-src` to override it.
const isScriptless = (csp: string): boolean => {
  const directives = csp.split(";").map((part) => part.trim());
  return (
    directives.includes("sandbox") ||
    (directives.includes("default-src 'none'") && !directives.some((d) => d.startsWith("script-src")))
  );
};

/** The value the last matching rule sets, which is the one Next sends. */
const effectiveHeader = async (pathname: string, key: string): Promise<string | undefined> => {
  const rules = (await nextConfig.headers?.()) ?? [];
  let value: string | undefined;
  for (const rule of rules) {
    const matches = getPathMatch(rule.source, {
      strict: true,
      removeUnnamedParams: true,
      sensitive: false,
    });
    const header = rule.headers.find((h) => h.key === key);
    if (header && matches(pathname) !== false) value = header.value;
  }
  return value;
};

beforeAll(async () => {
  for (const [name, value] of Object.entries(REQUIRED_ENV)) {
    vi.stubEnv(name, value);
  }
  nextConfig = (await import("../next.config.mjs")).default;
}, 30_000);

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("CSP for pages", () => {
  const effectiveCspOf = (pathname: string) => effectiveHeader(pathname, "Content-Security-Policy");

  // Browsers enforce every policy a response carries, so a page policy here could only block more than
  // the proxy's nonce policy, and scanners would still report it.
  test.each(["production", "development"])("next.config sets none on page routes in %s", async (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);

    for (const pathname of [
      "/",
      "/auth/login",
      "/workspaces/ws1/surveys",
      "/s/survey1",
      "/c/token",
      "/api/v1/x",
    ]) {
      expect(await effectiveCspOf(pathname), pathname).toBeUndefined();
    }
  });

  // proxy.ts does not run on asset paths, yet a missing asset there still renders the app's 404 page.
  test.each([
    "/js/missing.js",
    "/images/missing",
    "/animated-bgs/missing",
    "/_next/static/missing.js",
    "/_next/image",
    "/favicon.ico",
    "/robots.txt",
  ])(
    "gives %s, which the proxy skips, a policy with no inline code and no other origin",
    async (pathname) => {
      const csp = await effectiveCspOf(pathname);

      expect(csp).toMatch(/script-src 'self';/);
      expect(csp).not.toMatch(/(script|style)-src [^;]*'unsafe-inline'/);
      expect(csp).not.toContain("https:");
      expect(csp).toContain("object-src 'none'");
    }
  );
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

  // Chromium's media viewer runs script, so `sandbox` stops a directly opened video or song from
  // playing; `sandbox` may also stop a plugin-based PDF viewer. Both keep `default-src 'none'`, which
  // blocks every script of the file's own.
  const MEDIA_CSP = "default-src 'none'; media-src 'self'; frame-ancestors 'self'";
  const PDF_CSP = "default-src 'none'; object-src 'self'; frame-ancestors 'self'";
  const SANDBOX_CSP = "default-src 'none'; frame-ancestors 'self'; sandbox";
  const expectedCsp = (type: string): string =>
    type === "application/pdf" ? PDF_CSP : /^(audio|video)\//.test(type) ? MEDIA_CSP : SANDBOX_CSP;

  test.each(["/storage/ws1/private/report--fid--1.pdf", "/storage/ws1/private/report--fid--1.PDF"])(
    "serves %s scriptless, without sandbox, so the browser's PDF viewer still opens it",
    async (pathname) => {
      const csp = await effectiveCsp(pathname);
      expect(csp).toBe(PDF_CSP);
      expect(isScriptless(csp ?? "")).toBe(true);
    }
  );

  test.each(Object.entries(mimeTypes))(
    "serves an uploaded .%s (%s) under the policy for its type",
    async (extension, type) => {
      for (const name of [`file--fid--1.${extension}`, `FILE--fid--1.${extension.toUpperCase()}`]) {
        const csp = await effectiveCsp(`/storage/ws1/private/surveys/s1/elements/e1/${name}`);
        expect(csp, name).toBe(expectedCsp(type));
      }
    }
  );

  test("does not touch app pages", async () => {
    expect(await effectiveCsp("/workspaces/ws1/surveys")).toBeUndefined();
  });
});

describe("framing of the SSO recovery confirmation (ENG-7395)", () => {
  test("refuses every frame, same origin included", async () => {
    // X-Frame-Options here; `frame-ancestors 'none'` comes with the proxy's policy (lib/csp).
    expect(await effectiveHeader("/sso-recovery/confirm", "X-Frame-Options")).toBe("DENY");
  });

  test("leaves other app pages framable by their own origin", async () => {
    expect(await effectiveHeader("/auth/login", "X-Frame-Options")).toBe("SAMEORIGIN");
  });
});

describe("favicons carry no wildcard CORS header (cross-domain misconfiguration, ZAP 10098)", () => {
  // Every shipped favicon file, so a broader rule matching one of them (the .svg rule did) is caught.
  const faviconPaths = [
    "/favicon.ico",
    ...readdirSync(join(dirname(fileURLToPath(import.meta.url)), "../public/favicon")).map(
      (file) => `/favicon/${file}`
    ),
  ];

  test.each(faviconPaths)("%s", async (pathname) => {
    expect(await effectiveHeader(pathname, "Access-Control-Allow-Origin")).toBeUndefined();
  });

  test("other SVGs keep the shared SVG rule", async () => {
    expect(await effectiveHeader("/images/logo.svg", "Content-Type")).toBe("image/svg+xml");
  });
});
