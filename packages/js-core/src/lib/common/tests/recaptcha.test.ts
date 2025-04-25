import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { executeRecaptcha, loadRecaptchaScript } from "../recaptcha";

// Mocks for Logger and Config singletons
const loggerMock = { debug: vi.fn() };

// Mock Logger and Config getInstance
vi.mock("../logger", () => ({
  Logger: { getInstance: () => loggerMock },
}));

const recaptchaMock = {
  ready: vi.fn((cb: () => void) => {
    cb();
  }),
  execute: vi.fn(() => Promise.resolve("token-123")),
};

describe("loadRecaptchaScript", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("resolves if script already exists", async () => {
    const div = document.createElement("div");
    vi.spyOn(document, "getElementById").mockReturnValue(div);
    await expect(loadRecaptchaScript("abc")).resolves.toBeUndefined();
    expect(loggerMock.debug).toHaveBeenCalledWith("reCAPTCHA script already loaded");
  });

  test("rejects if site key is missing", async () => {
    vi.spyOn(document, "getElementById").mockReturnValue(null);
    await expect(loadRecaptchaScript(undefined)).rejects.toThrow("reCAPTCHA site key not found");
    expect(loggerMock.debug).toHaveBeenCalledWith("reCAPTCHA site key not found");
  });
});

describe("executeRecaptcha", () => {
  const mockRecaptchaSiteKey = "test-site-key";

  beforeEach(() => {
    const div = document.createElement("div");
    vi.spyOn(document, "getElementById").mockReturnValue(div);
  });

  afterEach(() => {
    // @ts-expect-error -- mock window.grecaptcha
    window.grecaptcha = recaptchaMock;
    vi.restoreAllMocks();
    loggerMock.debug.mockClear();
  });

  test("returns undefined if site key is missing", async () => {
    const result = await executeRecaptcha(undefined);
    expect(result).toBeUndefined();
    expect(loggerMock.debug).toHaveBeenCalledWith("reCAPTCHA site key not found");
  });

  test("returns token on success", async () => {
    const result = await executeRecaptcha(mockRecaptchaSiteKey, "my-action");
    expect(result).toBe("token-123");
    expect(window.grecaptcha.ready).toHaveBeenCalled();
    expect(window.grecaptcha.execute).toHaveBeenCalledWith("test-site-key", { action: "my-action" });
  });

  test("logs and returns undefined on error during execution", async () => {
    window.grecaptcha = {
      ...window.grecaptcha,
      execute: vi.fn(() => Promise.reject("fail")),
    };
    const result = await executeRecaptcha(mockRecaptchaSiteKey);
    expect(result).toBeUndefined();
    expect(loggerMock.debug).toHaveBeenCalledWith(
      expect.stringContaining("Error during reCAPTCHA execution: fail")
    );
  });
});
