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

  test("loads script successfully and resolves", async () => {
    vi.spyOn(document, "getElementById").mockReturnValue(null);

    const appendChildSpy = vi.spyOn(document.head, "appendChild").mockImplementation((element: Node) => {
      const script = element as HTMLScriptElement;
      setTimeout(() => script.onload?.(new Event("load")), 0);
      return element;
    });

    await expect(loadRecaptchaScript("valid-key")).resolves.toBeUndefined();
    appendChildSpy.mockRestore();
  });

  test("rejects when script loading fails", async () => {
    vi.spyOn(document, "getElementById").mockReturnValue(null);

    vi.spyOn(document.head, "appendChild").mockImplementation((element: Node) => {
      const script = element as HTMLScriptElement;
      setTimeout(() => script.onerror?.(new Event("error")), 0);
      return element;
    });

    await expect(loadRecaptchaScript("bad-key")).rejects.toThrow("Error loading reCAPTCHA script");
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

  test("returns null if site key is missing", async () => {
    const result = await executeRecaptcha(undefined);
    expect(result).toBeNull();
  });

  test("returns token on success", async () => {
    const result = await executeRecaptcha(mockRecaptchaSiteKey, "my-action");
    expect(result).toBe("token-123");
    expect(window.grecaptcha.ready).toHaveBeenCalled();
    expect(window.grecaptcha.execute).toHaveBeenCalledWith("test-site-key", { action: "my-action" });
  });

  test("logs and returns null on error during execution", async () => {
    window.grecaptcha = {
      ...window.grecaptcha,
      execute: vi.fn(() => Promise.reject(new Error("fail"))),
    };
    const result = await executeRecaptcha(mockRecaptchaSiteKey);
    expect(result).toBeNull();
  });

  test("logs and returns null if grecaptcha is not available", async () => {
    // @ts-expect-error intentionally removing grecaptcha
    delete window.grecaptcha;
    const result = await executeRecaptcha(mockRecaptchaSiteKey);
    expect(result).toBeNull();
  });
});
