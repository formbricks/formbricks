import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TProject } from "@formbricks/types/project";
import { TXMTemplate } from "@formbricks/types/templates";
import { replacePresetPlaceholders } from "./utils";

// Mock data
const mockProject: TProject = {
  id: "project1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Project",
  organizationId: "org1",
  styling: {
    allowStyleOverwrite: true,
    brandColor: { light: "#FFFFFF" },
  },
  recontactDays: 30,
  inAppSurveyBranding: true,
  linkSurveyBranding: true,
  config: {
    channel: "link" as const,
    industry: "eCommerce" as "eCommerce" | "saas" | "other" | null,
  },
  placement: "bottomRight",
  clickOutsideClose: true,
  darkOverlay: false,
  environments: [],
  languages: [],
  logo: null,
};
const mockTemplate: TXMTemplate = {
  name: "$[projectName] Survey",
  questions: [
    {
      id: "q1",
      inputType: "text",
      type: "email" as any,
      headline: { default: "$[projectName] Question" },
      required: false,
      charLimit: { enabled: true, min: 400, max: 1000 },
    },
  ],
  endings: [
    {
      id: "e1",
      type: "endScreen",
      headline: { default: "Thank you for completing the survey!" },
    },
  ],
  styling: {
    brandColor: { light: "#0000FF" },
    questionColor: { light: "#00FF00" },
    inputColor: { light: "#FF0000" },
  },
};

describe("replacePresetPlaceholders", () => {
  afterEach(() => {
    cleanup();
  });

  test("replaces projectName placeholder in template name", () => {
    const result = replacePresetPlaceholders(mockTemplate, mockProject);
    expect(result.name).toBe("Test Project Survey");
  });

  test("replaces projectName placeholder in question headline", () => {
    const result = replacePresetPlaceholders(mockTemplate, mockProject);
    expect(result.questions[0].headline.default).toBe("Test Project Question");
  });

  test("returns a new object without mutating the original template", () => {
    const originalTemplate = structuredClone(mockTemplate);
    const result = replacePresetPlaceholders(mockTemplate, mockProject);
    expect(result).not.toBe(mockTemplate);
    expect(mockTemplate).toEqual(originalTemplate);
  });
});
