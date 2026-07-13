import { getCurrentAuthContext } from "@better-auth/core/context";
import { APIError } from "better-auth/api";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";

// Real SHA-1 (node:crypto) so prefix/suffix are the actual values the plugin computes.
const suffixOf = (password: string): string =>
  createHash("sha1").update(password).digest("hex").toUpperCase().substring(5);

vi.mock("@better-auth/core/context", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Minimal constants mock so the heavy real module (and env) is not loaded; default: check enabled.
vi.mock("@/lib/constants", () => ({ PASSWORD_HIBP_CHECK_DISABLED: false }));

// Build a fetch Response for the range endpoint.
const rangeOk = (body: string) => ({ ok: true, status: 200, text: async () => body }) as unknown as Response;
const rangeErr = (status: number) => ({ ok: false, status, text: async () => "" }) as unknown as Response;

// A no-op original hash the plugin should delegate to when it allows a password.
const ORIGINAL_HASH_RESULT = "hashed";
const makeHash = async () => {
  const { hibpBreachCheckPlugin } = await import("./better-auth-hibp");
  const originalHash = vi.fn().mockResolvedValue(ORIGINAL_HASH_RESULT);
  const ctx = { password: { hash: originalHash, verify: vi.fn() } } as never;
  const wrapped = hibpBreachCheckPlugin.init(ctx).context.password.hash;
  return { hash: wrapped, originalHash };
};

describe("hibpBreachCheckPlugin — hash hook", () => {
  beforeEach(() => {
    vi.mocked(getCurrentAuthContext).mockResolvedValue({ path: "/sign-up/email" } as never);
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  test("rejects a password confirmed in the breach corpus", async () => {
    // CRLF + a leading/trailing space to prove trimming works.
    vi.mocked(fetch).mockResolvedValue(rangeOk(` ${suffixOf("breached")}:42 \r\nDEADBEEF:1`));
    const { hash, originalHash } = await makeHash();

    await expect(hash("breached")).rejects.toBeInstanceOf(APIError);
    await expect(hash("breached")).rejects.toMatchObject({ body: { code: "password_compromised" } });
    expect(originalHash).not.toHaveBeenCalled();
  });

  test("allows a password absent from the corpus", async () => {
    vi.mocked(fetch).mockResolvedValue(rangeOk("0000000000:1\nDEADBEEF:2"));
    const { hash, originalHash } = await makeHash();

    await expect(hash("clean")).resolves.toBe(ORIGINAL_HASH_RESULT);
    expect(originalHash).toHaveBeenCalledWith("clean");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("fails open (allows) when the range API returns a non-OK status", async () => {
    vi.mocked(fetch).mockResolvedValue(rangeErr(503));
    const { hash, originalHash } = await makeHash();

    await expect(hash("clean")).resolves.toBe(ORIGINAL_HASH_RESULT);
    expect(originalHash).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("fails open (allows) when the fetch throws (e.g. timeout)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("The operation was aborted"));
    const { hash, originalHash } = await makeHash();

    await expect(hash("clean")).resolves.toBe(ORIGINAL_HASH_RESULT);
    expect(originalHash).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("skips the check on a non-set path", async () => {
    vi.mocked(getCurrentAuthContext).mockResolvedValue({ path: "/sign-in/email" } as never);
    const { hash, originalHash } = await makeHash();

    await expect(hash("whatever")).resolves.toBe(ORIGINAL_HASH_RESULT);
    expect(fetch).not.toHaveBeenCalled();
    expect(originalHash).toHaveBeenCalledOnce();
  });

  test("skips the check entirely when disabled by env flag", async () => {
    vi.resetModules();
    vi.doMock("@/lib/constants", () => ({ PASSWORD_HIBP_CHECK_DISABLED: true }));
    const { hibpBreachCheckPlugin } = await import("./better-auth-hibp");
    const originalHash = vi.fn().mockResolvedValue(ORIGINAL_HASH_RESULT);
    const ctx = { password: { hash: originalHash, verify: vi.fn() } } as never;

    const hash = hibpBreachCheckPlugin.init(ctx).context.password.hash;
    await expect(hash("breached")).resolves.toBe(ORIGINAL_HASH_RESULT);
    expect(fetch).not.toHaveBeenCalled();
    expect(getCurrentAuthContext).not.toHaveBeenCalled();

    vi.doUnmock("@/lib/constants");
    vi.resetModules();
  });
});

describe("isPasswordCompromisedError", () => {
  test("true only for the plugin's compromised APIError", async () => {
    const { isPasswordCompromisedError } = await import("./better-auth-hibp");
    const compromised = new APIError("BAD_REQUEST", { message: "x", code: "password_compromised" });
    const otherApiError = new APIError("BAD_REQUEST", { message: "x", code: "SOMETHING_ELSE" });

    expect(isPasswordCompromisedError(compromised)).toBe(true);
    expect(isPasswordCompromisedError(otherApiError)).toBe(false);
    expect(isPasswordCompromisedError(new Error("nope"))).toBe(false);
    expect(isPasswordCompromisedError(null)).toBe(false);
  });
});
