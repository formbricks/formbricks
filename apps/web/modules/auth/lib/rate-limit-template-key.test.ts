import { describe, expect, test, vi } from "vitest";
import {
  UNMATCHED_AUTH_PATH_TEMPLATE,
  createAuthPathTemplateMatcher,
  createTemplateKeyedRateLimitStorage,
} from "./rate-limit-template-key";

const DECLARED = [
  "/sign-in/email",
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
    expect(templateOf(path.slice(0, 80))).toBe(UNMATCHED_AUTH_PATH_TEMPLATE);
  });

  test("treats empty segments as the router does, so extra slashes share the real endpoint's bucket", () => {
    expect(templateOf("//sign-in//email")).toBe("/sign-in/email");
    expect(templateOf("/reset-password//abc")).toBe("/reset-password/:token");
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
      defaultWindowSeconds: 10,
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
      "203.0.113.7|/reset-password/:token",
      "203.0.113.7|/reset-password/:token",
      `203.0.113.7|${UNMATCHED_AUTH_PATH_TEMPLATE}`,
      "2001:db8::|/callback/:id",
      "no-trusted-ip|/get-session",
    ]);
  });

  test("splits at the first `|`, so one in the path cannot forge the client part", async () => {
    const { storage, increment } = setup();
    await storage.consume("203.0.113.7|/x|198.51.100.1", { window: 10, max: 100 });
    expect(increment).toHaveBeenCalledWith(`203.0.113.7|${UNMATCHED_AUTH_PATH_TEMPLATE}`, 10);
  });

  test("passes the rule's window as the TTL, and falls back to the default window", async () => {
    const { storage, increment } = setup();
    await storage.consume("203.0.113.7|/get-session", { window: 60, max: 5 });
    await storage.consume("203.0.113.7|/get-session", { window: undefined as unknown as number, max: 5 });
    expect(increment.mock.calls.map(([, ttl]) => ttl)).toEqual([60, 10]);
  });

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

  test("reads the endpoint registry once, on first use", async () => {
    const declaredPaths = vi.fn(() => DECLARED);
    const storage = createTemplateKeyedRateLimitStorage({
      declaredPaths,
      increment: vi.fn(async () => 1),
      defaultWindowSeconds: 10,
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
      defaultWindowSeconds: 10,
    });
    await expect(storage.consume("203.0.113.7|/get-session", { window: 10, max: 100 })).rejects.toThrow(
      "Socket closed unexpectedly"
    );
  });
});
