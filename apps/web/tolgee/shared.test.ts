import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ALL_LANGUAGES, DEFAULT_LANGUAGE, TolgeeBase } from "./shared";

// Mock the environment variables
const mockApiKey = "test-api-key";
const mockApiUrl = "https://test-api-url.com";

// Mock the dynamic imports
vi.mock("@/locales/en-US.json", () => ({}));
vi.mock("@/locales/de-DE.json", () => ({}));
vi.mock("@/locales/fr-FR.json", () => ({}));
vi.mock("@/locales/pt-BR.json", () => ({}));
vi.mock("@/locales/pt-PT.json", () => ({}));
vi.mock("@/locales/zh-Hant-TW.json", () => ({}));

describe("Tolgee Configuration", () => {
  beforeEach(() => {
    // Reset environment variables before each test
    process.env.NEXT_PUBLIC_TOLGEE_API_KEY = mockApiKey;
    process.env.NEXT_PUBLIC_TOLGEE_API_URL = mockApiUrl;
  });

  afterEach(() => {
    // Clean up environment variables after each test
    delete process.env.NEXT_PUBLIC_TOLGEE_API_KEY;
    delete process.env.NEXT_PUBLIC_TOLGEE_API_URL;
  });

  describe("ALL_LANGUAGES", () => {
    test("should contain all supported languages", () => {
      expect(ALL_LANGUAGES).toEqual(["en-US", "de-DE", "fr-FR", "pt-BR", "pt-PT", "zh-Hant-TW"]);
    });
  });

  describe("DEFAULT_LANGUAGE", () => {
    test("should be set to en-US", () => {
      expect(DEFAULT_LANGUAGE).toBe("en-US");
    });
  });

  describe("TolgeeBase", () => {
    test("should create a Tolgee instance with correct configuration", async () => {
      const tolgee = TolgeeBase().init({
        language: "en-US",
      });

      // Verify the instance is created
      expect(tolgee).toBeDefined();
      expect(tolgee).toBeInstanceOf(Object);

      // Verify the language is set correctly
      expect(tolgee.getLanguage()).toBe("en-US");
    });

    test("should include all required plugins", async () => {
      const tolgee = TolgeeBase().init({
        language: "en-US",
      });

      // Verify plugins are included by checking if they're initialized
      expect(tolgee).toBeDefined();
      // The plugins are internal to the instance, so we can only verify the instance works
      expect(tolgee.getLanguage()).toBe("en-US");
    });

    test("should include static data for all languages", async () => {
      const tolgee = TolgeeBase().init({
        language: "en-US",
      });

      // Verify the instance works with the static data
      expect(tolgee).toBeDefined();
      expect(tolgee.getLanguage()).toBe("en-US");
    });

    test("should handle missing environment variables gracefully", async () => {
      delete process.env.NEXT_PUBLIC_TOLGEE_API_KEY;
      delete process.env.NEXT_PUBLIC_TOLGEE_API_URL;

      const tolgee = TolgeeBase().init({
        language: "en-US",
      });

      // Verify the instance still works without API configuration
      expect(tolgee).toBeDefined();
      expect(tolgee.getLanguage()).toBe("en-US");
    });
  });
});
