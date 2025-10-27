import { describe, expect, test, vi } from "vitest";
import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "./server";

vi.mock("@/lingodotdev/language", () => ({
  getLocale: vi.fn(),
}));

vi.mock("@/lingodotdev/shared", () => ({
  DEFAULT_LANGUAGE: "en-US",
}));

describe("lingodotdev server", () => {
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
});
