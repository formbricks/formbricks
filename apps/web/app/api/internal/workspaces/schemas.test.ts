import { describe, expect, test } from "vitest";
import { ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
import { STYLE_DEFAULTS } from "@/lib/styling/constants";
import { ZWorkspaceIdParams, ZWorkspacePatchBody } from "./schemas";

const parse = (body: unknown) => ZWorkspacePatchBody.safeParse(body);

describe("ZWorkspacePatchBody", () => {
  test("accepts a default survey language the survey runtime ships strings for", () => {
    expect(parse({ config: { defaultSurveyLanguage: "de-DE" } }).success).toBe(true);
    // Runtime-only languages are valid here even though the dashboard has no translation for them.
    expect(parse({ config: { defaultSurveyLanguage: "it-IT" } }).success).toBe(true);
  });

  test("accepts clearing the default survey language", () => {
    expect(parse({ config: { defaultSurveyLanguage: null } }).success).toBe(true);
    expect(parse({ config: {} }).success).toBe(true);
  });

  test("accepts a regional variant the runtime serves from its language's bundle", () => {
    for (const defaultSurveyLanguage of ["pt-PT", "de-AT", "es-MX", "en-GB"]) {
      expect(parse({ config: { defaultSurveyLanguage } }).success, defaultSurveyLanguage).toBe(true);
    }
  });

  test("rejects a default survey language the survey runtime ships no strings for", () => {
    // Only in the 215-entry workspace-language catalog, with no survey bundle behind them.
    for (const defaultSurveyLanguage of ["fa-IR", "aa-ET", "nonsense"]) {
      const result = parse({ config: { defaultSurveyLanguage } });
      expect(result.success, defaultSurveyLanguage).toBe(false);
      expect(result.error?.issues[0].path).toEqual(["config", "defaultSurveyLanguage"]);
    }
  });

  test("trims the name and refuses a blank one", () => {
    expect(parse({ name: "  Renamed " }).data).toEqual({ name: "Renamed" });
    expect(parse({ name: "  " }).success).toBe(false);
  });

  test("coerces a logo write's baseline to a date, and requires it with the logo", () => {
    const logo = { url: "https://example.com/logo.png" };
    expect(parse({ logo, expectedUpdatedAt: "2026-10-01T10:00:00.000Z" }).data).toEqual({
      logo,
      expectedUpdatedAt: new Date("2026-10-01T10:00:00.000Z"),
    });
    expect(parse({ logo }).error?.issues[0].path).toEqual(["expectedUpdatedAt"]);
  });

  test("accepts the theme form's whole styling, as Reset to default sends it", () => {
    expect(parse({ styling: STYLE_DEFAULTS }).success).toBe(true);
  });

  test.each([
    ["config", { config: { defaultSurveyLangauge: "de-DE" } }],
    ["styling", { styling: { ...STYLE_DEFAULTS, brandColour: { light: "#000000" } } }],
    [
      "a styling color",
      { styling: { ...STYLE_DEFAULTS, brandColor: { light: "#000000", hover: "#111111" } } },
    ],
    [
      "the card arrangement",
      {
        styling: {
          ...STYLE_DEFAULTS,
          cardArrangement: { linkSurveys: "simple", appSurveys: "simple", x: 1 },
        },
      },
    ],
    ["the styling background", { styling: { ...STYLE_DEFAULTS, background: { bg: "#fff", opacity: 1 } } }],
    ["the styling logo", { styling: { ...STYLE_DEFAULTS, logo: { url: undefined, size: 1 } } }],
    ["the logo", { logo: { bgColor: "#ffffff", width: 10 }, expectedUpdatedAt: "2026-10-01T10:00:00.000Z" }],
  ])("rejects an unknown key in %s", (_where, body) => {
    // The shared schema takes it, stripping the key; only the route's strict copy refuses it.
    expect(ZWorkspaceUpdateInput.safeParse(body).success).toBe(true);
    expect(parse(body).success).toBe(false);
  });

  // `/branding` is the one write path for branding, behind the licence check.
  test.each([["inAppSurveyBranding"], ["linkSurveyBranding"]])("rejects %s", (field) => {
    expect(parse({ [field]: false }).success).toBe(false);
  });
});

describe("ZWorkspaceIdParams", () => {
  test("rejects an unknown path parameter", () => {
    const workspaceId = "clwork1111111111111111111";
    expect(ZWorkspaceIdParams.safeParse({ workspaceId }).success).toBe(true);
    expect(ZWorkspaceIdParams.safeParse({ workspaceId, extra: "x" }).success).toBe(false);
  });
});
