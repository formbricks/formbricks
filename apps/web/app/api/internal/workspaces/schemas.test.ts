import { describe, expect, test } from "vitest";
import { ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
import { STYLE_DEFAULTS } from "@/lib/styling/constants";
import {
  STYLING_BRIGHTNESS_MAX,
  STYLING_NUMBER_MAX,
  STYLING_TEXT_MAX_LENGTH,
  WORKSPACE_HEAD_SCRIPTS_MAX_LENGTH,
  WORKSPACE_LOGO_BG_COLOR_MAX_LENGTH,
  WORKSPACE_NAME_MAX,
  WORKSPACE_RECONTACT_DAYS_MAX,
  ZWorkspaceDeletionBody,
  ZWorkspaceIdParams,
  ZWorkspacePatchBody,
} from "./schemas";

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

describe("ZWorkspacePatchBody input limits", () => {
  const text = (length: number) => "a".repeat(length);
  const BASELINE = { expectedUpdatedAt: "2026-10-01T10:00:00.000Z" };
  const styling = (overrides: Record<string, unknown>) => ({ styling: { ...STYLE_DEFAULTS, ...overrides } });
  const refusedAt = (body: unknown) => parse(body).error?.issues.map((issue) => issue.path.join("."));

  test.each([
    ["customHeadScripts", WORKSPACE_HEAD_SCRIPTS_MAX_LENGTH, (n: number) => ({ customHeadScripts: text(n) })],
    ["logo.url", 4096, (n: number) => ({ logo: { url: `/storage/${text(n - 9)}` }, ...BASELINE })],
    [
      "logo.bgColor",
      WORKSPACE_LOGO_BG_COLOR_MAX_LENGTH,
      (n: number) => ({ logo: { bgColor: text(n) }, ...BASELINE }),
    ],
    ["styling.fontFamily", STYLING_TEXT_MAX_LENGTH, (n: number) => styling({ fontFamily: text(n) })],
    ["styling.inputShadow", STYLING_TEXT_MAX_LENGTH, (n: number) => styling({ inputShadow: text(n) })],
    ["styling.buttonHeight", STYLING_TEXT_MAX_LENGTH, (n: number) => styling({ buttonHeight: text(n) })],
    [
      "styling.background.bg",
      4096,
      (n: number) => styling({ background: { bg: text(n), bgType: "image", brightness: 100 } }),
    ],
    ["styling.logo.url", 4096, (n: number) => styling({ logo: { url: `/storage/${text(n - 9)}` } })],
    [
      "styling.logo.bgColor",
      WORKSPACE_LOGO_BG_COLOR_MAX_LENGTH,
      (n: number) => styling({ logo: { bgColor: text(n) } }),
    ],
  ])("takes %s at %i characters and refuses one more", (field, max, build) => {
    expect(refusedAt(build(max))?.filter((path) => path === field) ?? []).toEqual([]);
    expect(refusedAt(build(max + 1))).toContain(field);
  });

  test("caps the default survey language before the runtime-language check reads it", () => {
    const issues = (length: number) =>
      parse({ config: { defaultSurveyLanguage: text(length) } }).error?.issues.map((issue) => issue.message);
    // At the cap only the language check refuses it; one past, the cap does.
    expect(issues(256)).toEqual(["Unsupported default survey language"]);
    expect(issues(257)).toContain("Too big: expected string to have <=256 characters");
  });

  test("takes the workspace name back as the deletion confirmation, and refuses a longer one", () => {
    expect(ZWorkspaceDeletionBody.safeParse({ confirmationName: text(WORKSPACE_NAME_MAX) }).success).toBe(
      true
    );
    expect(
      ZWorkspaceDeletionBody.safeParse({ confirmationName: text(WORKSPACE_NAME_MAX + 1) }).error?.issues[0]
        .path
    ).toEqual(["confirmationName"]);
  });

  test.each([
    ["recontactDays", 0, WORKSPACE_RECONTACT_DAYS_MAX, (n: number) => ({ recontactDays: n })],
    [
      "styling.buttonFontSize",
      -STYLING_NUMBER_MAX,
      STYLING_NUMBER_MAX,
      (n: number) => styling({ buttonFontSize: n }),
    ],
    ["styling.roundness", -STYLING_NUMBER_MAX, STYLING_NUMBER_MAX, (n: number) => styling({ roundness: n })],
    [
      "styling.background.brightness",
      0,
      STYLING_BRIGHTNESS_MAX,
      (n: number) => styling({ background: { bg: "#ffffff", bgType: "color", brightness: n } }),
    ],
  ])("takes %s from %i to %i and refuses either side", (field, min, max, build) => {
    expect(parse(build(min)).success).toBe(true);
    expect(parse(build(max)).success).toBe(true);
    expect(refusedAt(build(min - 1))).toEqual([field]);
    expect(refusedAt(build(max + 1))).toEqual([field]);
  });

  test("refuses a fractional cooldown", () => {
    expect(refusedAt({ recontactDays: 1.5 })).toEqual(["recontactDays"]);
  });
});

describe("ZWorkspaceIdParams", () => {
  test("rejects an unknown path parameter", () => {
    const workspaceId = "clwork1111111111111111111";
    expect(ZWorkspaceIdParams.safeParse({ workspaceId }).success).toBe(true);
    expect(ZWorkspaceIdParams.safeParse({ workspaceId, extra: "x" }).success).toBe(false);
  });
});
