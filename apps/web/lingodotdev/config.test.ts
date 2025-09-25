import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import { beforeEach, describe, expect, test, vi } from "vitest";

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

describe("i18n Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock functions to ensure they're spies
    mockI18n.use = vi.fn().mockReturnThis();
    mockI18n.init = vi.fn().mockReturnThis();
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
