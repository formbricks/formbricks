import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TProject } from "@formbricks/types/project";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TTemplate } from "@formbricks/types/templates";
import * as i18nUtils from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { replaceElementPresetPlaceholders, replacePresetPlaceholders } from "./templates";

vi.mock("@/lib/i18n/utils");
vi.mock("@/lib/pollyfills/structuredClone");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(structuredClone).mockImplementation((obj) => JSON.parse(JSON.stringify(obj)));
  // Mock getLocalizedValue to return the value from the object
  vi.mocked(i18nUtils.getLocalizedValue).mockImplementation((obj: any, lang: string) => obj?.[lang] || "");
});

describe("Template Utilities", () => {
  describe("replaceElementPresetPlaceholders", () => {
    test("returns original element when project is not provided", () => {
      const element = {
        type: "openText",
        headline: { default: "Question about $[projectName]?" },
      } as unknown as TSurveyElement;

      const result = replaceElementPresetPlaceholders(element, undefined as any);

      expect(result).toEqual(element);
    });

    test("replaces projectName placeholder in headline", () => {
      const element = {
        type: "openText",
        headline: { default: "How do you like $[projectName]?" },
      } as unknown as TSurveyElement;

      const project = {
        name: "TestProject",
      } as unknown as TProject;

      const result = replaceElementPresetPlaceholders(element, project);

      // The function directly replaces without calling getLocalizedValue in the test scenario
      expect(result.headline?.default).toBe("How do you like TestProject?");
    });

    test("replaces projectName placeholder in subheader", () => {
      const element = {
        type: "openText",
        headline: { default: "Question" },
        subheader: { default: "Subheader for $[projectName]" },
      } as unknown as TSurveyElement;

      const project = {
        name: "TestProject",
      } as unknown as TProject;

      const result = replaceElementPresetPlaceholders(element, project);

      expect(result.headline?.default).toBe("Question");
      expect(result.subheader?.default).toBe("Subheader for TestProject");
    });

    test("handles missing headline and subheader", () => {
      const element = {
        type: "openText",
      } as unknown as TSurveyElement;

      const project = {
        name: "TestProject",
      } as unknown as TProject;

      const result = replaceElementPresetPlaceholders(element, project);

      expect(structuredClone).toHaveBeenCalledWith(element);
      expect(result).toEqual(element);
    });
  });

  describe("replacePresetPlaceholders", () => {
    test("replaces projectName placeholder in template name and blocks", () => {
      const mockTemplate = {
        name: "Template 1",
        preset: {
          name: "$[projectName] Feedback",
          welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
          blocks: [
            {
              id: "block1",
              name: "Block 1",
              elements: [
                {
                  id: "elem1",
                  type: "openText",
                  headline: { default: "How would you rate $[projectName]?" },
                  required: true,
                  inputType: "text",
                },
              ],
            },
          ],
          endings: [],
          hiddenFields: { enabled: true, fieldIds: [] },
        },
      } as unknown as TTemplate;

      const project = {
        name: "TestProject",
      } as TProject;

      const result = replacePresetPlaceholders(mockTemplate, project);

      expect(structuredClone).toHaveBeenCalledWith(mockTemplate.preset);
      expect(result.preset.name).toBe("TestProject Feedback");
      expect(result.preset.blocks[0].elements[0].headline?.default).toBe("How would you rate TestProject?");
    });
  });
});
