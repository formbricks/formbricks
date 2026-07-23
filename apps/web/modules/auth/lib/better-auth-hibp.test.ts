import { APIError } from "better-auth/api";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";

// Real SHA-1 (node:crypto) so prefix/suffix are the actual values the hook computes.
const suffixOf = (password: string): string =>
  createHash("sha1").update(password).digest("hex").toUpperCase().substring(5);

vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Minimal constants mock so the heavy real module (and env) is not loaded; default: check enabled.
vi.mock("@/lib/constants", () => ({ PASSWORD_HIBP_CHECK_DISABLED: false }));

// Fake fetch Response for the range endpoint.
const rangeOk = (body: string) => ({ ok: true, status: 200, text: async () => body }) as unknown as Response;
const rangeErr = (status: number) => ({ ok: false, status, text: async () => "" }) as unknown as Response;

// Minimal AuthHookContext: the handler only reads `path` and `body`.
const ctxFor = (path: string, body: Record<string, unknown>) => ({ path, body }) as never;

const loadHandler = async () => (await import("./better-auth-hibp")).hibpBreachCheckBeforeHandler;

describe("hibpBreachCheckBeforeHandler", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  test("rejects a breached password on /sign-up/email (body.password)", async () => {
    // CRLF + surrounding whitespace to prove line-trimming works.
    vi.mocked(fetch).mockResolvedValue(rangeOk(` ${suffixOf("breached")}:42 \r\nDEADBEEF:1`));
    const handler = await loadHandler();

    const result = handler(ctxFor("/sign-up/email", { password: "breached" }));
    await expect(result).rejects.toBeInstanceOf(APIError);
    await expect(result).rejects.toMatchObject({ body: { code: "password_compromised" } });
  });

  test("rejects a breached password on /reset-password (body.newPassword)", async () => {
    vi.mocked(fetch).mockResolvedValue(rangeOk(`${suffixOf("breached")}:9`));
    const handler = await loadHandler();

    await expect(handler(ctxFor("/reset-password", { newPassword: "breached" }))).rejects.toMatchObject({
      body: { code: "password_compromised" },
    });
  });

  test("allows a password absent from the corpus", async () => {
    vi.mocked(fetch).mockResolvedValue(rangeOk("0000000000:1\nDEADBEEF:2"));
    const handler = await loadHandler();

    await expect(handler(ctxFor("/sign-up/email", { password: "clean" }))).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("fails open (allows) when the range API returns a non-OK status", async () => {
    vi.mocked(fetch).mockResolvedValue(rangeErr(503));
    const handler = await loadHandler();

    await expect(handler(ctxFor("/reset-password", { newPassword: "clean" }))).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("fails open (allows) when the fetch throws (e.g. timeout)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("The operation was aborted"));
    const handler = await loadHandler();

    await expect(handler(ctxFor("/sign-up/email", { password: "clean" }))).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("no-ops on a non-password-set path", async () => {
    const handler = await loadHandler();
    await expect(handler(ctxFor("/sign-in/email", { password: "whatever" }))).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("no-ops when the body carries no password", async () => {
    const handler = await loadHandler();
    await expect(handler(ctxFor("/reset-password", { token: "abc" }))).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("skips the check entirely when disabled by env flag", async () => {
    vi.resetModules();
    vi.doMock("@/lib/constants", () => ({ PASSWORD_HIBP_CHECK_DISABLED: true }));
    const handler = (await import("./better-auth-hibp")).hibpBreachCheckBeforeHandler;

    await expect(handler(ctxFor("/sign-up/email", { password: "breached" }))).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();

    // Restore the default (enabled) constants mock so later re-imports don't load the real env module.
    vi.doMock("@/lib/constants", () => ({ PASSWORD_HIBP_CHECK_DISABLED: false }));
    vi.resetModules();
  });
});

describe("isPasswordCompromisedError", () => {
  test("true only for the hook's compromised APIError", async () => {
    const { isPasswordCompromisedError } = await import("./better-auth-hibp");
    const compromised = new APIError("BAD_REQUEST", { message: "x", code: "password_compromised" });
    const otherApiError = new APIError("BAD_REQUEST", { message: "x", code: "SOMETHING_ELSE" });

    expect(isPasswordCompromisedError(compromised)).toBe(true);
    expect(isPasswordCompromisedError(otherApiError)).toBe(false);
    expect(isPasswordCompromisedError(new Error("nope"))).toBe(false);
    expect(isPasswordCompromisedError(null)).toBe(false);
  });
});
