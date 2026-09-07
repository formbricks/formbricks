import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSettingsPageMetadata } from "./metadata";

const translate = vi.fn();

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: () => Promise.resolve(translate),
}));

describe("getSettingsPageMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("titles the tab with the translated heading", async () => {
    translate.mockReturnValue("Tags");

    const metadata = await getSettingsPageMetadata("common.tags");

    expect(translate).toHaveBeenCalledWith("common.tags");
    expect(metadata).toEqual({ title: "Tags" });
  });

  test("uses the translation as-is, so the tab matches what the page shows", async () => {
    translate.mockReturnValue("Survey Languages");

    const metadata = await getSettingsPageMetadata("common.survey_languages");

    expect(metadata.title).toBe("Survey Languages");
  });
});
