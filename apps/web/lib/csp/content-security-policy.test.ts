import { describe, expect, test } from "vitest";
import {
  type TCspHosts,
  type TCspRouteProfile,
  buildContentSecurityPolicy,
  createCspNonce,
  getCspRoute,
} from "./content-security-policy";

const NO_HOSTS: TCspHosts = { appOrigins: [], storageOrigins: [], sentryOrigins: [], loopbackOrigins: [] };

const parse = (policy: string): Map<string, string[]> =>
  new Map(
    policy.split(";").map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    })
  );

const build = (
  profile: TCspRouteProfile,
  { isDevelopment = false, hosts = NO_HOSTS }: { isDevelopment?: boolean; hosts?: TCspHosts } = {}
) =>
  parse(
    buildContentSecurityPolicy({
      nonce: "abc123==",
      route: { profile, frameAncestors: "'self'" },
      hosts,
      isDevelopment,
    })
  );

const PROFILES: TCspRouteProfile[] = ["app", "workspace", "survey"];

describe("createCspNonce", () => {
  test("is 128 random bits, base64-encoded, and new every time", () => {
    const nonces = new Set(Array.from({ length: 50 }, createCspNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("buildContentSecurityPolicy", () => {
  test.each(PROFILES)("runs %s scripts only with the nonce, and lets them load the rest", (profile) => {
    expect(build(profile).get("script-src")).toEqual(["'self'", "'nonce-abc123=='", "'strict-dynamic'"]);
  });

  test.each(PROFILES)("applies %s style elements only with the nonce", (profile) => {
    const styleSources = build(profile).get("style-src");
    expect(styleSources).toContain("'nonce-abc123=='");
    expect(styleSources).not.toContain("'unsafe-inline'");
    // Server-rendered style props cannot carry a nonce.
    expect(build(profile).get("style-src-attr")).toEqual(["'unsafe-inline'"]);
  });

  test("allows no whole scheme or wildcard on pages without survey content", () => {
    for (const [name, sources] of build("app")) {
      expect(sources, name).not.toContain("https:");
      expect(sources, name).not.toContain("http:");
      expect(sources, name).not.toContain("*");
    }
  });

  test("allows survey images from any HTTPS host where survey content is shown, and nothing else", () => {
    const workspace = build("workspace");
    expect(workspace.get("img-src")).toContain("https:");
    for (const [name, sources] of workspace) {
      if (name !== "img-src") expect(sources, name).not.toContain("https:");
    }
  });

  test("lets public surveys reach the hosts their authors choose, but never for scripts or styles", () => {
    const survey = build("survey");
    for (const name of ["img-src", "connect-src", "frame-src"]) {
      expect(survey.get(name), name).toContain("https:");
    }
    for (const name of ["script-src", "style-src", "font-src", "media-src", "default-src"]) {
      expect(survey.get(name), name).not.toContain("https:");
    }
  });

  test.each(PROFILES)("keeps the %s policy's fixed directives", (profile) => {
    const policy = build(profile);
    expect(policy.get("default-src")).toEqual(["'self'"]);
    // Sentry Session Replay compresses in a blob: worker (ENG-3194).
    expect(policy.get("worker-src")).toEqual(["'self'", "blob:"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
    expect(policy.get("frame-ancestors")).toEqual(["'self'"]);
  });

  test("allows the configured app, storage and Sentry origins where the browser uses them", () => {
    const policy = build("app", {
      hosts: {
        appOrigins: ["https://surveys.example.com"],
        storageOrigins: ["https://files.example.com"],
        sentryOrigins: ["https://o1.ingest.sentry.io"],
        loopbackOrigins: [],
      },
    });
    expect(policy.get("connect-src")).toEqual(
      expect.arrayContaining([
        "https://surveys.example.com",
        "https://files.example.com",
        "https://o1.ingest.sentry.io",
      ])
    );
    expect(policy.get("img-src")).toEqual(
      expect.arrayContaining(["https://surveys.example.com", "https://files.example.com"])
    );
    expect(policy.get("frame-src")).toContain("https://surveys.example.com");
  });

  test("lets development run React's eval and unnonced dev styles", () => {
    const policy = build("app", { isDevelopment: true });
    expect(policy.get("script-src")).toContain("'unsafe-eval'");
    expect(policy.get("style-src")).toContain("'unsafe-inline'");
    expect(policy.get("style-src")).not.toContain("'nonce-abc123=='");
  });
});

describe("getCspRoute", () => {
  test.each([
    ["/", "app", "'self'"],
    ["/auth/login", "app", "'self'"],
    ["/auth/signup", "app", "'self'"],
    ["/auth/forgot-password", "app", "'self'"],
    ["/setup/intro", "app", "'self'"],
    ["/sso-recovery/confirm", "app", "'none'"],
    ["/workspaces/ws1/surveys", "workspace", "'self'"],
    ["/s/survey1", "survey", "*"],
    ["/c/token", "survey", "*"],
    ["/p/pretty-slug", "app", "'self'"],
    // Prefixes only match whole segments.
    ["/sso-recoveryx", "app", "'self'"],
    ["/share/x", "app", "'self'"],
    ["/workspacesx", "app", "'self'"],
  ])("%s gets the %s profile, framable by %s", (pathname, profile, frameAncestors) => {
    expect(getCspRoute(pathname)).toEqual({ profile, frameAncestors });
  });
});
