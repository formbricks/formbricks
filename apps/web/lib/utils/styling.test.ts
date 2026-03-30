import { describe, expect, test } from "vitest";
import { TJsEnvironmentStateSurvey, TJsEnvironmentStateWorkspace } from "@formbricks/types/js";
import { getStyling } from "./styling";

describe("Styling Utilities", () => {
  test("returns workspace styling when workspace does not allow style overwrite", () => {
    const workspace: TJsEnvironmentStateWorkspace = {
      styling: {
        allowStyleOverwrite: false,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsEnvironmentStateWorkspace;

    const survey: TJsEnvironmentStateSurvey = {
      styling: {
        overwriteThemeStyling: true,
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsEnvironmentStateSurvey;

    expect(getStyling(workspace, survey)).toBe(workspace.styling);
  });

  test("returns workspace styling when workspace allows style overwrite but survey does not overwrite", () => {
    const workspace: TJsEnvironmentStateWorkspace = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsEnvironmentStateWorkspace;

    const survey: TJsEnvironmentStateSurvey = {
      styling: {
        overwriteThemeStyling: false,
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsEnvironmentStateSurvey;

    expect(getStyling(workspace, survey)).toBe(workspace.styling);
  });

  test("returns survey styling when both workspace and survey allow style overwrite", () => {
    const workspace: TJsEnvironmentStateWorkspace = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsEnvironmentStateWorkspace;

    const survey: TJsEnvironmentStateSurvey = {
      styling: {
        overwriteThemeStyling: true,
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsEnvironmentStateSurvey;

    expect(getStyling(workspace, survey)).toBe(survey.styling);
  });

  test("returns workspace styling when workspace allows style overwrite but survey styling is undefined", () => {
    const workspace: TJsEnvironmentStateWorkspace = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsEnvironmentStateWorkspace;

    const survey: TJsEnvironmentStateSurvey = {
      styling: undefined,
    } as unknown as TJsEnvironmentStateSurvey;

    expect(getStyling(workspace, survey)).toBe(workspace.styling);
  });

  test("returns workspace styling when workspace allows style overwrite but survey overwriteThemeStyling is undefined", () => {
    const workspace: TJsEnvironmentStateWorkspace = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsEnvironmentStateWorkspace;

    const survey: TJsEnvironmentStateSurvey = {
      styling: {
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsEnvironmentStateSurvey;

    expect(getStyling(workspace, survey)).toBe(workspace.styling);
  });
});
