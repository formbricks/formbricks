import { beforeEach, describe, expect, test, vi } from "vitest";
import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "./server";

vi.mock("@/lingodotdev/language", () => ({
  getLocale: vi.fn(),
}));

vi.mock("@/lingodotdev/shared", () => ({
  DEFAULT_LANGUAGE: "en-US",
}));

describe("lingodotdev server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should get translate", async () => {
    vi.mocked(getLocale).mockResolvedValue("en-US");
    const translate = await getTranslate();
    expect(translate).toBeDefined();
  });

  test("should get translate with default locale", async () => {
    vi.mocked(getLocale).mockResolvedValue(undefined as any);
    const translate = await getTranslate();
    expect(translate).toBeDefined();
  });

  test("should use provided locale instead of calling getLocale", async () => {
    const translate = await getTranslate("de-DE");
    expect(getLocale).not.toHaveBeenCalled();
    expect(translate).toBeDefined();
  });

  test("should call getLocale when locale is not provided", async () => {
    vi.mocked(getLocale).mockResolvedValue("fr-FR");
    await getTranslate();
    expect(getLocale).toHaveBeenCalled();
  });
});
