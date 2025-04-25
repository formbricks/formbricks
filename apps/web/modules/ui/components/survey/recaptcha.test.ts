import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { executeRecaptcha, loadRecaptchaScript } from "./recaptcha";

vi.stubGlobal("window", {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  grecaptcha: {
    ready: vi.fn((cb: () => void) => {
      cb();
    }),
    execute: vi.fn(() => Promise.resolve("token-123")),
  },
});

vi.stubGlobal("document", {
  getElementById: vi.fn(() => {
    return {
      id: "formbricks-recaptcha-script",
      parentNode: {
        removeChild: vi.fn(),
      },
    };
  }),
  createElement: vi.fn(() => {
    return {
      id: "formbricks-recaptcha-script",
      src: "",
      async: true,
      defer: true,
      onload: vi.fn(),
      onerror: vi.fn(),
      parentNode: {
        appendChild: vi.fn(),
      },
    };
  }),
  head: {
    appendChild: vi.fn(),
  },
  removeChild: vi.fn(),
});

const recaptchaMock = {
  ready: vi.fn((cb: () => void) => {
    cb();
  }),
  execute: vi.fn(() => Promise.resolve("token-123")),
};

describe("loadRecaptchaScript", () => {
  beforeEach(() => {
    // Mock the global window.grecaptcha
    // @ts-expect-error -- mock window.grecaptcha
    window.grecaptcha = recaptchaMock;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("resolves if script already exists", async () => {
    const div = document.createElement("div");
    vi.spyOn(document, "getElementById").mockReturnValue(div);
    await expect(loadRecaptchaScript("abc")).resolves.toBeUndefined();
  });

  test("rejects if site key is missing", async () => {
    vi.spyOn(document, "getElementById").mockReturnValue(null);
    await expect(loadRecaptchaScript(undefined)).rejects.toThrow("reCAPTCHA site key not found");
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
  });

  test("returns undefined if site key is missing", async () => {
    const result = await executeRecaptcha(undefined);
    expect(result).toBeUndefined();
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
  });
});
