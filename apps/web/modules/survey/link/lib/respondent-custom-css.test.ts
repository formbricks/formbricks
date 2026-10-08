import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TCustomCssStored } from "@formbricks/types/custom-css";
import { toDeliveredCustomCss } from "@/modules/custom-css/lib/delivery";
import {
  getLinkSurveyCustomCss,
  omitCustomCssSource,
  resolveRespondentCustomCss,
} from "./respondent-custom-css";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/custom-css/lib/delivery", () => ({ toDeliveredCustomCss: vi.fn() }));

const stored = (light: string, dark: string | null = null): TCustomCssStored => ({
  light: { source: `/* source */ ${light}`, compiled: `@layer fb-x { ${light} }` },
  dark: dark ? { source: `/* source */ ${dark}`, compiled: `@layer fb-x-dark { ${dark} }` } : null,
  processorVersion: 1,
});

// A survey whose "Add custom styles" is on, so its own CSS applies.
const overriding = { overwriteThemeStyling: true };

// Delivery as W2's contract describes it: compiled output only, `undefined` when withheld.
const deliverCompiled = async (value: TCustomCssStored | null | undefined) =>
  value
    ? {
        ...(value.light ? { light: value.light.compiled } : {}),
        ...(value.dark ? { dark: value.dark.compiled } : {}),
      }
    : undefined;

describe("resolveRespondentCustomCss", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(toDeliveredCustomCss).mockImplementation(deliverCompiled);
  });

  test("delivers the workspace CSS once and each survey's own, compiled only", async () => {
    const result = await resolveRespondentCustomCss({
      workspaceCustomCss: stored(".w{}", ".wd{}"),
      allowStyleOverwrite: true,
      surveys: [
        { id: "s1", customCss: stored(".s1{}"), styling: overriding },
        { id: "s2", customCss: null, styling: overriding },
        { id: "s3", customCss: stored(".s3{}", ".s3d{}"), styling: overriding },
      ],
    });

    expect(result.workspace).toEqual({ light: "@layer fb-x { .w{} }", dark: "@layer fb-x-dark { .wd{} }" });
    expect(Object.fromEntries(result.surveys)).toEqual({
      s1: { light: "@layer fb-x { .s1{} }" },
      s3: { light: "@layer fb-x { .s3{} }", dark: "@layer fb-x-dark { .s3d{} }" },
    });
    expect(JSON.stringify({ ...result, surveys: [...result.surveys] })).not.toContain("source");
  });

  test("touches no storage when the workspace and its surveys have no CSS at all", async () => {
    const result = await resolveRespondentCustomCss({
      workspaceCustomCss: null,
      allowStyleOverwrite: true,
      surveys: [{ id: "s1", customCss: null, styling: overriding }, { id: "s2" }],
    });

    expect(result.workspace).toBeUndefined();
    expect(result.surveys.size).toBe(0);
    expect(toDeliveredCustomCss).not.toHaveBeenCalled();
  });

  test("withholds a survey's CSS while its style overrides are off, and keeps the workspace CSS", async () => {
    const surveys = [
      { id: "on", customCss: stored(".on{}"), styling: overriding },
      { id: "off", customCss: stored(".off{}"), styling: { overwriteThemeStyling: false } },
      { id: "unset", customCss: stored(".unset{}"), styling: null },
    ];

    const allowed = await resolveRespondentCustomCss({
      workspaceCustomCss: stored(".w{}"),
      allowStyleOverwrite: true,
      surveys,
    });
    const workspaceOff = await resolveRespondentCustomCss({
      workspaceCustomCss: stored(".w{}"),
      allowStyleOverwrite: false,
      surveys,
    });

    expect([...allowed.surveys.keys()]).toEqual(["on"]);
    expect(workspaceOff.surveys.size).toBe(0);
    expect(workspaceOff.workspace).toEqual({ light: "@layer fb-x { .w{} }" });
    // A withheld survey costs no delivery work: only the workspace and the one applied survey ran.
    expect(toDeliveredCustomCss).toHaveBeenCalledTimes(3);
  });

  test("a scope delivery withholds or that throws is omitted; the others still go out", async () => {
    vi.mocked(toDeliveredCustomCss).mockImplementation(async (value, scope) => {
      if (scope === "workspace") throw new Error("reprocessing failed");
      if (value?.light?.source.includes(".stale")) return undefined;
      return deliverCompiled(value);
    });

    const result = await resolveRespondentCustomCss({
      workspaceCustomCss: stored(".w{}"),
      allowStyleOverwrite: true,
      surveys: [
        { id: "s1", customCss: stored(".stale{}"), styling: overriding },
        { id: "s2", customCss: stored(".s2{}"), styling: overriding },
      ],
    });

    expect(result.workspace).toBeUndefined();
    expect([...result.surveys.keys()]).toEqual(["s2"]);
  });

  test("passes on only non-empty light/dark strings, whatever else delivery returns", async () => {
    vi.mocked(toDeliveredCustomCss).mockResolvedValue({
      light: "@layer fb-workspace {}",
      dark: "  ",
      source: ".leak{}",
      processorVersion: 3,
    } as never);

    const result = await resolveRespondentCustomCss({
      workspaceCustomCss: stored(".w{}"),
      allowStyleOverwrite: true,
      surveys: [],
    });

    expect(result.workspace).toEqual({ light: "@layer fb-workspace {}" });
  });
});

describe("getLinkSurveyCustomCss", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(toDeliveredCustomCss).mockImplementation(deliverCompiled);
  });

  test("builds the renderer prop with only the scopes that have CSS to deliver", async () => {
    await expect(
      getLinkSurveyCustomCss({
        workspaceCustomCss: null,
        allowStyleOverwrite: true,
        survey: { id: "s1", customCss: stored(".s{}"), styling: overriding },
      })
    ).resolves.toEqual({ survey: { light: "@layer fb-x { .s{} }" } });

    await expect(
      getLinkSurveyCustomCss({
        workspaceCustomCss: stored(".w{}"),
        allowStyleOverwrite: true,
        survey: { id: "s1", customCss: stored(".s{}"), styling: { overwriteThemeStyling: false } },
      })
    ).resolves.toEqual({ workspace: { light: "@layer fb-x { .w{} }" } });
  });

  test("returns nothing when neither scope has CSS to deliver", async () => {
    await expect(
      getLinkSurveyCustomCss({
        workspaceCustomCss: null,
        allowStyleOverwrite: false,
        survey: { id: "s1", customCss: stored(".s{}"), styling: overriding },
      })
    ).resolves.toBeUndefined();
  });
});

describe("omitCustomCssSource", () => {
  test("drops the stored value, source and all, and keeps everything else", () => {
    const survey = { id: "s1", name: "Survey", customCss: stored(".s{}") };

    const publicSurvey = omitCustomCssSource(survey);

    expect(publicSurvey).toEqual({ id: "s1", name: "Survey", customCss: null });
    expect(JSON.stringify(publicSurvey)).not.toContain("source");
  });
});
