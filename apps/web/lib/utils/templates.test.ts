import { getLocalizedValue } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TProject } from "@formbricks/types/project";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TTemplate } from "@formbricks/types/templates";
import { replacePresetPlaceholders, replaceQuestionPresetPlaceholders } from "./templates";

// Mock the imported functions
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn(),
}));

vi.mock("@/lib/pollyfills/structuredClone", () => ({
  structuredClone: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
}));

describe("Template Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("replaceQuestionPresetPlaceholders", () => {
    test("returns original question when project is not provided", () => {
      const question: TSurveyQuestion = {
        id: "test-id",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "Test Question $[projectName]",
        },
      } as unknown as TSurveyQuestion;

      const result = replaceQuestionPresetPlaceholders(question, undefined as unknown as TProject);

      expect(result).toEqual(question);
      expect(structuredClone).not.toHaveBeenCalled();
    });

    test("replaces projectName placeholder in subheader", () => {
      const question: TSurveyQuestion = {
        id: "test-id",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "Test Question",
        },
        subheader: {
          default: "Subheader for $[projectName]",
        },
      } as unknown as TSurveyQuestion;

      const project: TProject = {
        id: "project-id",
        name: "Test Project",
        organizationId: "org-id",
      } as unknown as TProject;

      // Mock for headline and subheader with correct return values
      vi.mocked(getLocalizedValue).mockReturnValueOnce("Test Question");
      vi.mocked(getLocalizedValue).mockReturnValueOnce("Subheader for $[projectName]");

      const result = replaceQuestionPresetPlaceholders(question, project);

      expect(vi.mocked(getLocalizedValue)).toHaveBeenCalledTimes(2);
      expect(result.subheader?.default).toBe("Subheader for Test Project");
    });

    test("handles missing headline and subheader", () => {
      const question: TSurveyQuestion = {
        id: "test-id",
        type: TSurveyQuestionTypeEnum.OpenText,
      } as unknown as TSurveyQuestion;

      const project: TProject = {
        id: "project-id",
        name: "Test Project",
        organizationId: "org-id",
      } as unknown as TProject;

      const result = replaceQuestionPresetPlaceholders(question, project);

      expect(structuredClone).toHaveBeenCalledWith(question);
      expect(result).toEqual(question);
      expect(getLocalizedValue).not.toHaveBeenCalled();
    });
  });

  describe("replacePresetPlaceholders", () => {
    test("replaces projectName placeholder in template name and questions", () => {
      const template: TTemplate = {
        id: "template-1",
        name: "Test Template",
        description: "Template Description",
        preset: {
          name: "$[projectName] Feedback",
          questions: [
            {
              id: "q1",
              type: TSurveyQuestionTypeEnum.OpenText,
              headline: {
                default: "How do you like $[projectName]?",
              },
            },
            {
              id: "q2",
              type: TSurveyQuestionTypeEnum.OpenText,
              headline: {
                default: "Another question",
              },
              subheader: {
                default: "About $[projectName]",
              },
            },
          ],
        },
        category: "product",
      } as unknown as TTemplate;

      const project = {
        name: "Awesome App",
      };

      // Mock getLocalizedValue to return the original strings with placeholders
      vi.mocked(getLocalizedValue)
        .mockReturnValueOnce("How do you like $[projectName]?")
        .mockReturnValueOnce("Another question")
        .mockReturnValueOnce("About $[projectName]");

      const result = replacePresetPlaceholders(template, project);

      expect(result.preset.name).toBe("Awesome App Feedback");
      expect(structuredClone).toHaveBeenCalledWith(template.preset);

      // Verify that replaceQuestionPresetPlaceholders was applied to both questions
      expect(vi.mocked(getLocalizedValue)).toHaveBeenCalledTimes(3);
      expect(result.preset.questions[0].headline?.default).toBe("How do you like Awesome App?");
      expect(result.preset.questions[1].subheader?.default).toBe("About Awesome App");
    });

    test("maintains other template properties", () => {
      const template: TTemplate = {
        id: "template-1",
        name: "Test Template",
        description: "Template Description",
        preset: {
          name: "$[projectName] Feedback",
          questions: [],
        },
        category: "product",
      } as unknown as TTemplate;

      const project = {
        name: "Awesome App",
      };

      const result = replacePresetPlaceholders(template, project) as unknown as {
        name: string;
        description: string;
      };

      expect(result.name).toBe(template.name);
      expect(result.description).toBe(template.description);
    });
  });
});
