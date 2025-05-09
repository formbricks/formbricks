import { getLocalizedValue } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import "@testing-library/jest-dom/vitest";
import { describe, expect, test, vi } from "vitest";
import { TProject } from "@formbricks/types/project";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TTemplate } from "@formbricks/types/templates";
import {
  getChannelMapping,
  getIndustryMapping,
  getRoleMapping,
  replacePresetPlaceholders,
  replaceQuestionPresetPlaceholders,
} from "./utils";

vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn(),
}));

vi.mock("@/lib/pollyfills/structuredClone", () => ({
  structuredClone: vi.fn((val) => JSON.parse(JSON.stringify(val))),
}));

describe("Template utils", () => {
  test("replaceQuestionPresetPlaceholders replaces project name in headline and subheader", () => {
    const mockQuestion = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: {
        default: "How would you rate $[projectName]?",
      },
      subheader: {
        default: "Tell us about $[projectName]",
      },
      required: false,
    } as unknown as TSurveyQuestion;

    const mockProject = {
      id: "project-1",
      name: "TestProject",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as TProject;

    // Reset and setup mocks with simple return values
    vi.mocked(getLocalizedValue).mockReset();
    vi.mocked(getLocalizedValue)
      .mockReturnValueOnce("How would you rate $[projectName]?")
      .mockReturnValueOnce("Tell us about $[projectName]");

    const result = replaceQuestionPresetPlaceholders(mockQuestion, mockProject);

    expect(structuredClone).toHaveBeenCalledWith(mockQuestion);
    expect(getLocalizedValue).toHaveBeenCalledTimes(2);
    expect(result.headline?.default).toBe("How would you rate TestProject?");
    expect(result.subheader?.default).toBe("Tell us about TestProject");
  });

  test("replaceQuestionPresetPlaceholders returns original question if project is null", () => {
    const mockQuestion = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: {
        default: "How would you rate $[projectName]?",
      },
      required: false,
    } as unknown as TSurveyQuestion;

    const result = replaceQuestionPresetPlaceholders(mockQuestion, null as unknown as TProject);
    expect(result).toBe(mockQuestion);
  });

  test("replaceQuestionPresetPlaceholders handles missing subheader", () => {
    const mockQuestion = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: {
        default: "How would you rate $[projectName]?",
      },
      required: false,
    } as unknown as TSurveyQuestion;

    const mockProject = {
      id: "project-1",
      name: "TestProject",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as TProject;
    vi.mocked(getLocalizedValue).mockReturnValueOnce("How would you rate $[projectName]?");

    const result = replaceQuestionPresetPlaceholders(mockQuestion, mockProject);

    expect(result.headline?.default).toBe("How would you rate TestProject?");
    expect(result.subheader).toBeUndefined();
  });

  test("replacePresetPlaceholders replaces project name in template", () => {
    const mockTemplate: TTemplate = {
      name: "Test Template",
      description: "Template description",
      preset: {
        name: "$[projectName] Feedback",
        questions: [
          {
            id: "q1",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: {
              default: "How would you rate $[projectName]?",
            },
            required: false,
          } as unknown as TSurveyQuestion,
        ],
      } as any,
    };

    const mockProject = {
      name: "TestProject",
    };

    vi.mocked(getLocalizedValue).mockReturnValueOnce("How would you rate $[projectName]?");

    const result = replacePresetPlaceholders(mockTemplate, mockProject);

    expect(structuredClone).toHaveBeenCalledWith(mockTemplate.preset);
    expect(result.preset.name).toBe("TestProject Feedback");
    expect(result.preset.questions[0].headline?.default).toBe("How would you rate TestProject?");
  });

  test("getChannelMapping returns correct channel mappings", () => {
    const mockT = vi.fn((key) => key);

    const result = getChannelMapping(mockT);

    expect(result).toEqual([
      { value: "website", label: "common.website_survey" },
      { value: "app", label: "common.app_survey" },
      { value: "link", label: "common.link_survey" },
    ]);
    expect(mockT).toHaveBeenCalledWith("common.website_survey");
    expect(mockT).toHaveBeenCalledWith("common.app_survey");
    expect(mockT).toHaveBeenCalledWith("common.link_survey");
  });

  test("getIndustryMapping returns correct industry mappings", () => {
    const mockT = vi.fn((key) => key);

    const result = getIndustryMapping(mockT);

    expect(result).toEqual([
      { value: "eCommerce", label: "common.e_commerce" },
      { value: "saas", label: "common.saas" },
      { value: "other", label: "common.other" },
    ]);
    expect(mockT).toHaveBeenCalledWith("common.e_commerce");
    expect(mockT).toHaveBeenCalledWith("common.saas");
    expect(mockT).toHaveBeenCalledWith("common.other");
  });

  test("getRoleMapping returns correct role mappings", () => {
    const mockT = vi.fn((key) => key);

    const result = getRoleMapping(mockT);

    expect(result).toEqual([
      { value: "productManager", label: "common.product_manager" },
      { value: "customerSuccess", label: "common.customer_success" },
      { value: "marketing", label: "common.marketing" },
      { value: "sales", label: "common.sales" },
      { value: "peopleManager", label: "common.people_manager" },
    ]);
    expect(mockT).toHaveBeenCalledWith("common.product_manager");
    expect(mockT).toHaveBeenCalledWith("common.customer_success");
    expect(mockT).toHaveBeenCalledWith("common.marketing");
    expect(mockT).toHaveBeenCalledWith("common.sales");
    expect(mockT).toHaveBeenCalledWith("common.people_manager");
  });
});
