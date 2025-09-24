import i18n from "i18next";
import ICU from "i18next-icu";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_LANGUAGE } from "@/lingodotdev/shared";

// Mock all the modules before importing them
vi.mock("i18next", () => ({
  default: {
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockReturnThis(),
  },
}));

vi.mock("i18next-icu", () => ({
  default: vi.fn(),
}));

vi.mock("i18next-resources-to-backend", () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock("react-i18next", () => ({
  initReactI18next: vi.fn(),
}));

vi.mock("@/lingodotdev/shared", () => ({
  DEFAULT_LANGUAGE: "en",
}));

const mockI18n = vi.mocked(i18n);
const mockICU = vi.mocked(ICU);
const mockInitReactI18next = vi.mocked(initReactI18next);
const mockResourcesToBackend = vi.mocked(resourcesToBackend);
const mockDefaultLanguage = vi.mocked(DEFAULT_LANGUAGE);

describe("i18n Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock functions to ensure they're spies
    mockI18n.use = vi.fn().mockReturnThis();
    mockI18n.init = vi.fn().mockReturnThis();
  });

  test("should not initialize i18n on server side", async () => {
    // Mock server environment (window is undefined)
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    // Re-import the module to test server-side behavior
    vi.resetModules();
    await import("./config");

    expect(mockI18n.use).not.toHaveBeenCalled();
    expect(mockI18n.init).not.toHaveBeenCalled();

    // Restore window
    global.window = originalWindow;
  });

  test("should initialize i18n on client side", async () => {
    // Mock client environment (window exists)
    Object.defineProperty(global, "window", {
      value: {},
      writable: true,
      configurable: true,
    });

    // Re-import the module to test client-side behavior
    vi.resetModules();
    await import("./config");

    expect(mockI18n.use).toHaveBeenCalledTimes(3);
    expect(mockI18n.use).toHaveBeenCalledWith(mockICU);
    expect(mockI18n.use).toHaveBeenCalledWith(mockInitReactI18next);
  });
});
