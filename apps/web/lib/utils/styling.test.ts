import { describe, expect, test } from "vitest";
import { TJsWorkspaceStateSurvey, TJsWorkspaceStateWorkspaceSetting } from "@formbricks/types/js";
import { getStyling } from "./styling";

describe("Styling Utilities", () => {
  test("returns workspace styling when workspace does not allow style overwrite", () => {
    const workspace: TJsWorkspaceStateWorkspaceSetting = {
      styling: {
        allowStyleOverwrite: false,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsWorkspaceStateWorkspaceSetting;

    const survey: TJsWorkspaceStateSurvey = {
      styling: {
        overwriteThemeStyling: true,
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsWorkspaceStateSurvey;

    expect(getStyling(workspace, survey)).toBe(workspace.styling);
  });

  test("returns workspace styling when workspace allows style overwrite but survey does not overwrite", () => {
    const workspace: TJsWorkspaceStateWorkspaceSetting = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsWorkspaceStateWorkspaceSetting;

    const survey: TJsWorkspaceStateSurvey = {
      styling: {
        overwriteThemeStyling: false,
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsWorkspaceStateSurvey;

    expect(getStyling(workspace, survey)).toBe(workspace.styling);
  });

  test("returns survey styling when both workspace and survey allow style overwrite", () => {
    const workspace: TJsWorkspaceStateWorkspaceSetting = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsWorkspaceStateWorkspaceSetting;

    const survey: TJsWorkspaceStateSurvey = {
      styling: {
        overwriteThemeStyling: true,
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsWorkspaceStateSurvey;

    expect(getStyling(workspace, survey)).toBe(survey.styling);
  });

  test("returns workspace styling when workspace allows style overwrite but survey styling is undefined", () => {
    const workspace: TJsWorkspaceStateWorkspaceSetting = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsWorkspaceStateWorkspaceSetting;

    const survey: TJsWorkspaceStateSurvey = {
      styling: undefined,
    } as unknown as TJsWorkspaceStateSurvey;

    expect(getStyling(workspace, survey)).toBe(workspace.styling);
  });

  test("returns workspace styling when workspace allows style overwrite but survey overwriteThemeStyling is undefined", () => {
    const workspace: TJsWorkspaceStateWorkspaceSetting = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsWorkspaceStateWorkspaceSetting;

    const survey: TJsWorkspaceStateSurvey = {
      styling: {
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsWorkspaceStateSurvey;

    expect(getStyling(workspace, survey)).toBe(workspace.styling);
  });
});
