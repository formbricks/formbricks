import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { TXMTemplate } from "@formbricks/types/templates";
import { TWorkspace } from "@formbricks/types/workspace";
import { replacePresetPlaceholders } from "./utils";

// Mock data
const mockWorkspace: TWorkspace = {
  id: "workspace1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Workspace",
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
  overlay: "none",
  appSetupCompleted: false,
  environments: [],
  languages: [],
  logo: null,
};
const mockTemplate: TXMTemplate = {
  name: "$[workspaceName] Survey",
  blocks: [
    {
      id: "block1",
      name: "Block 1",
      elements: [
        {
          id: "q1",
          type: "openText" as TSurveyElementTypeEnum.OpenText,
          inputType: "text" as const,
          headline: { default: "$[workspaceName] Question" },
          subheader: { default: "" },
          required: false,
          placeholder: { default: "" },
          charLimit: { enabled: true, max: 1000 },
        },
      ],
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

  test("replaces workspaceName placeholder in template name", () => {
    const result = replacePresetPlaceholders(mockTemplate, mockWorkspace);
    expect(result.name).toBe("Test Workspace Survey");
  });

  test("replaces workspaceName placeholder in element headline", () => {
    const result = replacePresetPlaceholders(mockTemplate, mockWorkspace);
    expect(result.blocks[0].elements[0].headline.default).toBe("Test Workspace Question");
  });

  test("returns a new object without mutating the original template", () => {
    const originalTemplate = structuredClone(mockTemplate);
    const result = replacePresetPlaceholders(mockTemplate, mockWorkspace);
    expect(result).not.toBe(mockTemplate);
    expect(mockTemplate).toEqual(originalTemplate);
  });
});
