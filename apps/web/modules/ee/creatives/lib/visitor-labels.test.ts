import { describe, expect, test, vi } from "vitest";
import { getBannerLabels, toLabelLocale } from "./visitor-labels";

vi.mock("server-only", () => ({}));

// The dashboard's own translator, stubbed so each word says which locale and key it came from.
vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(async (locale: string) => (key: string) => `${locale}|${key}`),
}));

describe("toLabelLocale", () => {
  test("takes a dashboard locale as it is", () => {
    expect(toLabelLocale("de-DE")).toBe("de-DE");
    expect(toLabelLocale("pt-PT")).toBe("pt-PT");
  });

  test("reaches a dashboard locale through the canonical code or the same base language", () => {
    expect(toLabelLocale("de")).toBe("de-DE");
    expect(toLabelLocale("de-AT")).toBe("de-DE");
    expect(toLabelLocale("zh-TW")).toBe("zh-Hant-TW");
  });

  test("gives English to a language the dashboard isn't translated into", () => {
    expect(toLabelLocale("it-IT")).toBe("en-US");
  });
});

describe("getBannerLabels", () => {
  test("names the region and its Dismiss control in each of the banner's languages", async () => {
    const labels = await getBannerLabels(["de-AT", "it-IT"]);

    expect(labels).toEqual({
      siteNotice: {
        "de-AT": "de-DE|workspace.creatives.visitor_site_notice",
        "it-IT": "en-US|workspace.creatives.visitor_site_notice",
      },
      dismiss: {
        "de-AT": "de-DE|workspace.creatives.visitor_dismiss",
        "it-IT": "en-US|workspace.creatives.visitor_dismiss",
      },
    });
  });
});
