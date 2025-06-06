import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/preact";
import { TFnType } from "@tolgee/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getXMSurveyDefault, getXMTemplates } from "./xm-templates";

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("xm-templates", () => {
  afterEach(() => {
    cleanup();
  });

  test("getXMSurveyDefault returns default survey template", () => {
    const tMock = vi.fn((key) => key) as TFnType;
    const result = getXMSurveyDefault(tMock);

    expect(result).toEqual({
      name: "",
      endings: expect.any(Array),
      questions: [],
      styling: {
        overwriteThemeStyling: true,
      },
    });
    expect(result.endings).toHaveLength(1);
  });

  test("getXMTemplates returns all templates", () => {
    const tMock = vi.fn((key) => key) as TFnType;
    const result = getXMTemplates(tMock);

    expect(result).toHaveLength(6);
    expect(result[0].name).toBe("templates.nps_survey_name");
    expect(result[1].name).toBe("templates.star_rating_survey_name");
    expect(result[2].name).toBe("templates.csat_survey_name");
    expect(result[3].name).toBe("templates.cess_survey_name");
    expect(result[4].name).toBe("templates.smileys_survey_name");
    expect(result[5].name).toBe("templates.enps_survey_name");
  });

  test("getXMTemplates handles errors gracefully", async () => {
    const tMock = vi.fn(() => {
      throw new Error("Test error");
    }) as TFnType;

    const result = getXMTemplates(tMock);

    // Dynamically import the mocked logger
    const { logger } = await import("@formbricks/logger");

    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      "Unable to load XM templates, returning empty array"
    );
  });
});
