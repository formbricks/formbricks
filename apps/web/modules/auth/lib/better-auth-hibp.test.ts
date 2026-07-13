import { getCurrentAuthContext } from "@better-auth/core/context";
import { betterFetch } from "@better-fetch/fetch";
import { APIError } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";

// Deterministic SHA-1 so prefix/suffix are known: prefix = "ABCDE", suffix = rest (uppercased).
const FAKE_SHA1 = "abcde0123456789abcdef0123456789abcdef012"; // 40 hex chars
const FAKE_SUFFIX = FAKE_SHA1.substring(5).toUpperCase();

vi.mock("@better-auth/utils/hash", () => ({
  createHash: () => ({ digest: vi.fn().mockResolvedValue(FAKE_SHA1) }),
}));
vi.mock("@better-fetch/fetch", () => ({ betterFetch: vi.fn() }));
vi.mock("@better-auth/core/context", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Minimal constants mock so the heavy real module (and env) is not loaded; default: check enabled.
vi.mock("@/lib/constants", () => ({ PASSWORD_HIBP_CHECK_DISABLED: false }));

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
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("rejects a password confirmed in the breach corpus", async () => {
    vi.mocked(betterFetch).mockResolvedValue({ data: `${FAKE_SUFFIX}:42\nDEADBEEF:1`, error: null } as never);
    const { hash, originalHash } = await makeHash();

    await expect(hash("breached")).rejects.toBeInstanceOf(APIError);
    await expect(hash("breached")).rejects.toMatchObject({ body: { code: "password_compromised" } });
    expect(originalHash).not.toHaveBeenCalled();
  });

  test("allows a password absent from the corpus", async () => {
    vi.mocked(betterFetch).mockResolvedValue({ data: "0000000000:1\nDEADBEEF:2", error: null } as never);
    const { hash, originalHash } = await makeHash();

    await expect(hash("clean")).resolves.toBe(ORIGINAL_HASH_RESULT);
    expect(originalHash).toHaveBeenCalledWith("clean");
    expect(betterFetch).toHaveBeenCalledTimes(1);
  });

  test("fails open (allows) when the range API returns an error", async () => {
    vi.mocked(betterFetch).mockResolvedValue({ data: null, error: { status: 503 } } as never);
    const { hash, originalHash } = await makeHash();

    await expect(hash("clean")).resolves.toBe(ORIGINAL_HASH_RESULT);
    expect(originalHash).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("fails open (allows) when the fetch throws (e.g. timeout)", async () => {
    vi.mocked(betterFetch).mockRejectedValue(new Error("The operation was aborted"));
    const { hash, originalHash } = await makeHash();

    await expect(hash("clean")).resolves.toBe(ORIGINAL_HASH_RESULT);
    expect(originalHash).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("skips the check on a non-set path", async () => {
    vi.mocked(getCurrentAuthContext).mockResolvedValue({ path: "/sign-in/email" } as never);
    const { hash, originalHash } = await makeHash();

    await expect(hash("whatever")).resolves.toBe(ORIGINAL_HASH_RESULT);
    expect(betterFetch).not.toHaveBeenCalled();
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
    expect(betterFetch).not.toHaveBeenCalled();
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
