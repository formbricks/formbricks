import { afterEach, describe, expect, test, vi } from "vitest";
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/lib/localStorage";

const securityError = () => new DOMException("The operation is insecure.", "SecurityError");

// Safari with "Block all cookies", a sandboxed iframe or a locked-down profile: reading the
// `localStorage` property itself throws, before any method is called.
const denyStorageAccess = () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw securityError();
    },
  });
};

const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalDescriptor);
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
  vi.unstubAllGlobals();
});

describe("readLocalStorage", () => {
  test("returns the stored value", () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn().mockReturnValue("Email") });
    expect(readLocalStorage("key")).toBe("Email");
  });

  test("returns null when the browser denies access to localStorage", () => {
    denyStorageAccess();
    expect(readLocalStorage("key")).toBeNull();
  });

  test("returns null when the browser has no localStorage at all", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readLocalStorage("key")).toBeNull();
  });

  test("returns null when getItem itself throws a DOMException", () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => {
        throw securityError();
      }),
    });
    expect(readLocalStorage("key")).toBeNull();
  });

  test("rethrows errors that are not storage denials", () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => {
        throw new TypeError("a bug of ours");
      }),
    });
    expect(() => readLocalStorage("key")).toThrow(TypeError);
  });
});

describe("writeLocalStorage", () => {
  test("stores the value", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    writeLocalStorage("key", "value");
    expect(setItem).toHaveBeenCalledWith("key", "value");
  });

  test("does nothing when the browser denies access to localStorage", () => {
    denyStorageAccess();
    expect(() => writeLocalStorage("key", "value")).not.toThrow();
  });

  test("does nothing when the quota is exceeded", () => {
    vi.stubGlobal("localStorage", {
      setItem: vi.fn(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }),
    });
    expect(() => writeLocalStorage("key", "value")).not.toThrow();
  });
});

describe("removeLocalStorage", () => {
  test("removes the value", () => {
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", { removeItem });
    removeLocalStorage("key");
    expect(removeItem).toHaveBeenCalledWith("key");
  });

  test("does nothing when the browser denies access to localStorage", () => {
    denyStorageAccess();
    expect(() => removeLocalStorage("key")).not.toThrow();
  });
});
