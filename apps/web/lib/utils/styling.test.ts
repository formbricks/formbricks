import { describe, expect, test } from "vitest";
import { TJsEnvironmentStateProject, TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { getStyling } from "./styling";

describe("Styling Utilities", () => {
  test("returns project styling when project does not allow style overwrite", () => {
    const project: TJsEnvironmentStateProject = {
      styling: {
        allowStyleOverwrite: false,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsEnvironmentStateProject;

    const survey: TJsEnvironmentStateSurvey = {
      styling: {
        overwriteThemeStyling: true,
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsEnvironmentStateSurvey;

    expect(getStyling(project, survey)).toBe(project.styling);
  });

  test("returns project styling when project allows style overwrite but survey does not overwrite", () => {
    const project: TJsEnvironmentStateProject = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsEnvironmentStateProject;

    const survey: TJsEnvironmentStateSurvey = {
      styling: {
        overwriteThemeStyling: false,
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsEnvironmentStateSurvey;

    expect(getStyling(project, survey)).toBe(project.styling);
  });

  test("returns survey styling when both project and survey allow style overwrite", () => {
    const project: TJsEnvironmentStateProject = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsEnvironmentStateProject;

    const survey: TJsEnvironmentStateSurvey = {
      styling: {
        overwriteThemeStyling: true,
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsEnvironmentStateSurvey;

    expect(getStyling(project, survey)).toBe(survey.styling);
  });

  test("returns project styling when project allows style overwrite but survey styling is undefined", () => {
    const project: TJsEnvironmentStateProject = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsEnvironmentStateProject;

    const survey: TJsEnvironmentStateSurvey = {
      styling: undefined,
    } as unknown as TJsEnvironmentStateSurvey;

    expect(getStyling(project, survey)).toBe(project.styling);
  });

  test("returns project styling when project allows style overwrite but survey overwriteThemeStyling is undefined", () => {
    const project: TJsEnvironmentStateProject = {
      styling: {
        allowStyleOverwrite: true,
        brandColor: "#000000",
        highlightBorderColor: "#000000",
      },
    } as unknown as TJsEnvironmentStateProject;

    const survey: TJsEnvironmentStateSurvey = {
      styling: {
        brandColor: "#ffffff",
        highlightBorderColor: "#ffffff",
      },
    } as unknown as TJsEnvironmentStateSurvey;

    expect(getStyling(project, survey)).toBe(project.styling);
  });
});
