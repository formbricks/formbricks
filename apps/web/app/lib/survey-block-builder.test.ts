import type { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { createI18nString } from "@/lib/i18n/utils";
import { buildBlock } from "./survey-block-builder";

const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    "common.next": "Next",
    "common.back": "Back",
    "": "",
  };
  return translations[key] || key;
}) as unknown as TFunction;

describe("survey-block-builder", () => {
  describe("buildBlock", () => {
    const mockElements = [
      {
        id: "element-1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: createI18nString("Test Question", []),
        required: false,
        inputType: "text",
        longAnswer: false,
        charLimit: { enabled: false },
      },
    ];

    test("should use getDefaultButtonLabel when buttonLabel is provided", () => {
      const result = buildBlock({
        name: "Test Block",
        elements: mockElements,
        buttonLabel: "Custom Next",
        t: mockT,
      });

      expect(result.buttonLabel).toEqual({
        default: "Custom Next",
      });
    });

    test("should use createI18nString with empty translation when buttonLabel is not provided", () => {
      const result = buildBlock({
        name: "Test Block",
        elements: mockElements,
        t: mockT,
      });

      expect(result.buttonLabel).toEqual({
        default: "",
      });
    });

    test("should use getDefaultBackButtonLabel when backButtonLabel is provided", () => {
      const result = buildBlock({
        name: "Test Block",
        elements: mockElements,
        backButtonLabel: "Custom Back",
        t: mockT,
      });

      expect(result.backButtonLabel).toEqual({
        default: "Custom Back",
      });
    });

    test("should use createI18nString with empty translation when backButtonLabel is not provided", () => {
      const result = buildBlock({
        name: "Test Block",
        elements: mockElements,
        t: mockT,
      });

      expect(result.backButtonLabel).toEqual({
        default: "",
      });
    });
  });
});
