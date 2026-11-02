import { beforeEach, describe, expect, test, vi } from "vitest";
import { getLocale } from "@/lingodotdev/language";
import { getLocaleMessages, getTranslate } from "./server";

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

  test("getLocaleMessages loads only the requested locale's catalogue", async () => {
    const messages = (await getLocaleMessages("de-DE")) as { common: { language: string } };
    expect(messages.common.language).toBe("Sprache");
  });

  test("getLocaleMessages fills keys missing from a translation with en-US", async () => {
    vi.doMock("../locales/de-DE.json", () => ({ default: { common: { language: "Sprache" } } }));
    vi.resetModules();
    const { getLocaleMessages: load } = await import("./server");
    const messages = (await load("de-DE")) as { common: { language: string; select: string } };
    vi.doUnmock("../locales/de-DE.json");

    expect(messages.common.language).toBe("Sprache");
    expect(messages.common.select).toBe("Select");
  });

  test("should call getLocale when locale is not provided", async () => {
    vi.mocked(getLocale).mockResolvedValue("fr-FR");
    await getTranslate();
    expect(getLocale).toHaveBeenCalled();
  });
});
