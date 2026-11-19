import { describe, expect, test, vi } from "vitest";
import {
  UNMATCHED_AUTH_PATH_TEMPLATE,
  createAuthPathTemplateMatcher,
  createTemplateKeyedRateLimitStorage,
} from "./rate-limit-template-key";

const DECLARED = [
  "/sign-in/email",
  "/delete-user",
  "/get-session",
  "/reset-password",
  "/reset-password/:token",
  "/callback/:id",
  "/admin/oauth2/resources/:identifier/clients/:client_id",
  undefined,
  42,
  "not-a-path",
];

describe("createAuthPathTemplateMatcher (ENG-7399)", () => {
  const templateOf = createAuthPathTemplateMatcher(DECLARED);

  test.each([
    ["/sign-in/email", "/sign-in/email"],
    ["/get-session", "/get-session"],
    ["/reset-password", "/reset-password"],
    ["/reset-password/abc123", "/reset-password/:token"],
    [`/reset-password/${"t".repeat(12_000)}`, "/reset-password/:token"],
    ["/callback/google", "/callback/:id"],
    ["/admin/oauth2/resources/r1/clients/c1", "/admin/oauth2/resources/:identifier/clients/:client_id"],
  ])("names %s by its declared template", (path, template) => {
    expect(templateOf(path)).toBe(template);
  });

  test.each([
    `/${"j".repeat(12_000)}`,
    `/get-session/${"j".repeat(12_000)}`,
    "/sign-in",
    "/sign-in/email/extra",
    "/reset-password/a/b",
    "/callback",
    "/Sign-In/Email",
    "/sign-in%2Femail",
    "/",
    "",
  ])("sends %s, which names no endpoint, to the one unmatched bucket", (path) => {
    expect(templateOf(path)).toBe(UNMATCHED_AUTH_PATH_TEMPLATE);
  });

  test("sends a path with an empty segment to the unmatched bucket, as the router 404s it", () => {
    // Counting `//delete-user` under `/delete-user` would let it share that endpoint's counter while Better
    // Auth applies it a different rule, and so a different TTL.
    expect(templateOf("//sign-in//email")).toBe(UNMATCHED_AUTH_PATH_TEMPLATE);
    expect(templateOf("/reset-password//abc")).toBe(UNMATCHED_AUTH_PATH_TEMPLATE);
    expect(templateOf("/callback//")).toBe(UNMATCHED_AUTH_PATH_TEMPLATE);
  });

  test("never emits a request's own path, whatever it is", () => {
    const templates = new Set(
      DECLARED.filter((path): path is string => typeof path === "string" && path.startsWith("/"))
    );
    for (const path of ["/x", "/reset-password/secret-token", "/callback/evil", `/${"z".repeat(500)}`]) {
      const template = templateOf(path);
      expect(template === UNMATCHED_AUTH_PATH_TEMPLATE || templates.has(template)).toBe(true);
    }
  });
});

describe("createTemplateKeyedRateLimitStorage (ENG-7399)", () => {
  const setup = (counts: number[] = []) => {
    const increment = vi.fn(async (_key: string, _ttl: number) => counts.shift() ?? 1);
    const storage = createTemplateKeyedRateLimitStorage({
      declaredPaths: () => DECLARED,
      increment,
    });
    return { storage, increment };
  };

  test("keys on the client and the template, not the raw path", async () => {
    const { storage, increment } = setup();
    await storage.consume(`203.0.113.7|/reset-password/${"t".repeat(12_000)}`, { window: 60, max: 5 });
    await storage.consume("203.0.113.7|/reset-password/other-token", { window: 60, max: 5 });
    await storage.consume(`203.0.113.7|/${"j".repeat(12_000)}`, { window: 10, max: 100 });
    await storage.consume("2001:db8::|/callback/google", { window: 10, max: 100 });
    await storage.consume("no-trusted-ip|/get-session", { window: 10, max: 100 });

    expect(increment.mock.calls.map(([key]) => key)).toEqual([
      "203.0.113.7|/reset-password/:token|60",
      "203.0.113.7|/reset-password/:token|60",
      `203.0.113.7|${UNMATCHED_AUTH_PATH_TEMPLATE}|10`,
      "2001:db8::|/callback/:id|10",
      "no-trusted-ip|/get-session|10",
    ]);
  });

  test("splits at the first `|`, so one in the path cannot forge the client part", async () => {
    const { storage, increment } = setup();
    await storage.consume("203.0.113.7|/x|198.51.100.1", { window: 10, max: 100 });
    expect(increment).toHaveBeenCalledWith(`203.0.113.7|${UNMATCHED_AUTH_PATH_TEMPLATE}|10`, 10);
  });

  test("passes the rule's window as the TTL, and keeps a counter per window", async () => {
    // A request that Better Auth gives another rule can't reset the TTL of an endpoint's counter: it counts
    // apart, under its own window.
    const { storage, increment } = setup();
    await storage.consume("203.0.113.7|/delete-user", { window: 3600, max: 5 });
    await storage.consume("203.0.113.7|/delete-user", { window: 10, max: 100 });
    expect(increment.mock.calls).toEqual([
      ["203.0.113.7|/delete-user|3600", 3600],
      ["203.0.113.7|/delete-user|10", 10],
    ]);
  });

  test.each([undefined, 0, Number.NaN])(
    "falls back to a 10 s window when a rule's window is %s",
    async (window) => {
      const { storage, increment } = setup([1]);
      const outcome = await storage.consume("203.0.113.7|/get-session", { window: window as number, max: 1 });
      expect(increment).toHaveBeenCalledWith("203.0.113.7|/get-session|10", 10);
      expect(outcome).toEqual({ allowed: true, retryAfter: null });
    }
  );

  test("allows up to max, then refuses with the window as retry-after", async () => {
    const { storage } = setup([5, 6]);
    expect(await storage.consume("203.0.113.7|/sign-in/email", { window: 60, max: 5 })).toEqual({
      allowed: true,
      retryAfter: null,
    });
    expect(await storage.consume("203.0.113.7|/sign-in/email", { window: 60, max: 5 })).toEqual({
      allowed: false,
      retryAfter: 60,
    });
  });

  test("hashes a key not in Better Auth's `${ip}|${path}` shape, so it can never be caller-sized", async () => {
    const { storage, increment } = setup();
    await storage.consume(`no-separator-${"j".repeat(12_000)}`, { window: 10, max: 100 });
    const [key] = increment.mock.calls[0];
    // (vitestSetup fakes `createHash`, so the digest itself isn't checked here: only that none of the
    // caller's key survives and the length is fixed.)
    expect(key.startsWith("sha256:")).toBe(true);
    expect(key).not.toContain("jjj");
    expect(key.length).toBeLessThan(80);
  });

  test("reads the registry again while it is empty, rather than keeping an unmatched-only matcher", async () => {
    let registry: unknown[] = [];
    const increment = vi.fn(async (_key: string, _ttl: number) => 1);
    const storage = createTemplateKeyedRateLimitStorage({ declaredPaths: () => registry, increment });
    await storage.consume("203.0.113.7|/get-session", { window: 10, max: 100 });
    registry = DECLARED;
    await storage.consume("203.0.113.7|/get-session", { window: 10, max: 100 });
    expect(increment.mock.calls.map(([key]) => key)).toEqual([
      `203.0.113.7|${UNMATCHED_AUTH_PATH_TEMPLATE}|10`,
      "203.0.113.7|/get-session|10",
    ]);
  });

  test("reads the endpoint registry once, on first use", async () => {
    const declaredPaths = vi.fn(() => DECLARED);
    const storage = createTemplateKeyedRateLimitStorage({
      declaredPaths,
      increment: vi.fn(async () => 1),
    });
    expect(declaredPaths).not.toHaveBeenCalled();
    await storage.consume("203.0.113.7|/get-session", { window: 10, max: 100 });
    await storage.consume("203.0.113.7|/sign-in/email", { window: 10, max: 100 });
    expect(declaredPaths).toHaveBeenCalledTimes(1);
  });

  test("lets a Redis failure propagate, as Better Auth's own secondary storage does", async () => {
    const storage = createTemplateKeyedRateLimitStorage({
      declaredPaths: () => DECLARED,
      increment: vi.fn(async () => {
        throw new Error("Socket closed unexpectedly");
      }),
    });
    await expect(storage.consume("203.0.113.7|/get-session", { window: 10, max: 100 })).rejects.toThrow(
      "Socket closed unexpectedly"
    );
  });
});
