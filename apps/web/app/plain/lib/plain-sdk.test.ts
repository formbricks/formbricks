import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  PLAIN_SESSION_STORAGE_KEY,
  type PlainInstance,
  logoutPlain,
  logoutPlainBeforeNavigation,
} from "./plain-sdk";

vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));

const createFakePlain = (overrides: Partial<PlainInstance> = {}): PlainInstance => ({
  init: vi.fn(),
  update: vi.fn(),
  setCustomerDetails: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
  isInitialized: vi.fn(() => true),
  ...overrides,
});

describe("logoutPlain", () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("closes the widget, hides the launcher, and clears the customer", async () => {
    const plain = createFakePlain();

    await logoutPlain(plain);

    expect(plain.close).toHaveBeenCalledTimes(1);
    expect(plain.update).toHaveBeenCalledWith({ hideLauncher: true });
    expect(plain.setCustomerDetails).toHaveBeenCalledWith(null);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("still clears the customer when earlier steps throw, and never rethrows", async () => {
    const plain = createFakePlain({
      close: vi.fn(() => {
        throw new Error("close broke");
      }),
      update: vi.fn(() => Promise.reject(new Error("update broke"))),
    });

    await expect(logoutPlain(plain)).resolves.toBeUndefined();

    expect(plain.setCustomerDetails).toHaveBeenCalledWith(null);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  test("waits for the clear to settle before refreshing the session through update", async () => {
    let resolveClear!: () => void;
    const plain = createFakePlain({
      setCustomerDetails: vi.fn(() => new Promise<void>((resolve) => (resolveClear = resolve))),
    });

    const pending = logoutPlain(plain);
    await Promise.resolve();

    expect(plain.setCustomerDetails).toHaveBeenCalledWith(null);
    expect(plain.update).not.toHaveBeenCalled();
    expect(plain.close).not.toHaveBeenCalled();

    resolveClear();
    await pending;

    expect(plain.update).toHaveBeenCalledWith({ hideLauncher: true });
    expect(plain.close).toHaveBeenCalledTimes(1);
  });

  test("drops the persisted session only after the other steps have written it", async () => {
    const store = new Map([[PLAIN_SESSION_STORAGE_KEY, "previous-user-session"]]);
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
    const plain = createFakePlain({
      update: vi.fn(() => {
        store.set(PLAIN_SESSION_STORAGE_KEY, "refreshed-session");
      }),
    });

    await logoutPlain(plain);

    expect(store.has(PLAIN_SESSION_STORAGE_KEY)).toBe(false);
  });

  test("swallows a rejected logout without logging identity data", async () => {
    const plain = createFakePlain({
      setCustomerDetails: vi.fn(() => Promise.reject(new Error("unsupported"))),
    });

    await expect(logoutPlain(plain)).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      { step: "clearCustomer", error: "unsupported" },
      "Plain SDK call failed"
    );
  });
});

describe("logoutPlainBeforeNavigation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("does nothing when the widget never loaded", async () => {
    vi.stubGlobal("Plain", undefined);
    await expect(logoutPlainBeforeNavigation()).resolves.toBeUndefined();
  });

  test("does nothing when the widget is loaded but not initialized", async () => {
    const plain = createFakePlain({ isInitialized: vi.fn(() => false) });
    vi.stubGlobal("Plain", plain);

    await logoutPlainBeforeNavigation();

    expect(plain.setCustomerDetails).not.toHaveBeenCalled();
  });

  test("logs an initialized widget out", async () => {
    const plain = createFakePlain();
    vi.stubGlobal("Plain", plain);

    await logoutPlainBeforeNavigation();

    expect(plain.setCustomerDetails).toHaveBeenCalledWith(null);
  });

  test("stops waiting after the timeout when Plain never settles", async () => {
    vi.useFakeTimers();
    const plain = createFakePlain({ setCustomerDetails: vi.fn(() => new Promise(() => undefined)) });
    vi.stubGlobal("Plain", plain);

    const pending = logoutPlainBeforeNavigation(100);
    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).resolves.toBeUndefined();
  });
});
