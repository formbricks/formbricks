import { describe, expect, test } from "vitest";
import {
  DESTINATION_SURVEY_PAGE_SIZE,
  buildDestinationSurveySearchQuery,
  toDestinationSurveyOption,
  toLanguageCheckLanguages,
} from "./destination-survey-api";

const workspaceId = "clseedworkspace000000000";

describe("buildDestinationSurveySearchQuery", () => {
  test("asks only for surveys that can be a Destination, running ones first", () => {
    const query = buildDestinationSurveySearchQuery(workspaceId, "");

    expect(Object.fromEntries(query)).toEqual({
      workspaceId,
      limit: String(DESTINATION_SURVEY_PAGE_SIZE),
      includeTotalCount: "false",
      "filter[type][in]": "app,link",
      "filter[singleUse][eq]": "false",
      "filter[pinProtected][eq]": "false",
      sortBy: "relevance",
    });
  });

  test("searches by name only when there is a search", () => {
    expect(buildDestinationSurveySearchQuery(workspaceId, "plan").get("filter[name][contains]")).toBe("plan");
    expect(buildDestinationSurveySearchQuery(workspaceId, "").has("filter[name][contains]")).toBe(false);
  });
});

describe("toDestinationSurveyOption", () => {
  test("keeps what the picker and its warnings read from a list item", () => {
    const item = {
      id: "survey-1",
      name: "Site feedback",
      type: "app" as const,
      status: "paused" as const,
      visibility: "restricted" as const,
      responseCount: 12,
    };

    expect(toDestinationSurveyOption(item)).toEqual({
      id: "survey-1",
      name: "Site feedback",
      type: "app",
      status: "paused",
      visibility: "restricted",
    });
  });
});

describe("toLanguageCheckLanguages", () => {
  test("reads a translated survey's languages as the language check matches them", () => {
    expect(
      toLanguageCheckLanguages([
        { code: "de-DE", default: true, enabled: true },
        { code: "fr-FR", default: false, enabled: false, alias: "fr" },
      ])
    ).toEqual([
      { default: true, enabled: true, language: { code: "de-DE", alias: null } },
      { default: false, enabled: false, language: { code: "fr-FR", alias: "fr" } },
    ]);
  });

  test("reads the API's stand-in for an untranslated survey as unknown", () => {
    expect(toLanguageCheckLanguages([{ code: "en-US", default: true, enabled: true }])).toBeUndefined();
  });

  test("keeps a single language other than the stand-in", () => {
    expect(toLanguageCheckLanguages([{ code: "fr-FR", default: true, enabled: true }])).toEqual([
      { default: true, enabled: true, language: { code: "fr-FR", alias: null } },
    ]);
  });
});
