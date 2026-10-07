import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TCustomCssStored } from "@formbricks/types/custom-css";
import { toDeliveredCustomCss } from "@/modules/custom-css/lib/delivery";
import { getIsCustomCssRolledOut } from "@/modules/custom-css/lib/rollout";
import {
  getLinkSurveyCustomCss,
  omitCustomCssSource,
  resolveRespondentCustomCss,
} from "./respondent-custom-css";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/custom-css/lib/delivery", () => ({ toDeliveredCustomCss: vi.fn() }));
vi.mock("@/modules/custom-css/lib/rollout", () => ({ getIsCustomCssRolledOut: vi.fn() }));

const stored = (light: string, dark: string | null = null): TCustomCssStored => ({
  light: { source: `/* source */ ${light}`, compiled: `@layer fb-x { ${light} }` },
  dark: dark ? { source: `/* source */ ${dark}`, compiled: `@layer fb-x-dark { ${dark} }` } : null,
  processorVersion: 1,
});

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
    vi.mocked(getIsCustomCssRolledOut).mockResolvedValue(true);
    vi.mocked(toDeliveredCustomCss).mockImplementation(deliverCompiled);
  });

  test("delivers the workspace CSS once and each survey's own, compiled only", async () => {
    const result = await resolveRespondentCustomCss({
      organizationId: "org-1",
      workspaceCustomCss: stored(".w{}", ".wd{}"),
      surveys: [
        { id: "s1", customCss: stored(".s1{}") },
        { id: "s2", customCss: null },
        { id: "s3", customCss: stored(".s3{}", ".s3d{}") },
      ],
    });

    expect(result.workspace).toEqual({ light: "@layer fb-x { .w{} }", dark: "@layer fb-x-dark { .wd{} }" });
    expect(Object.fromEntries(result.surveys)).toEqual({
      s1: { light: "@layer fb-x { .s1{} }" },
      s3: { light: "@layer fb-x { .s3{} }", dark: "@layer fb-x-dark { .s3d{} }" },
    });
    expect(JSON.stringify({ ...result, surveys: [...result.surveys] })).not.toContain("source");
    // The flag is asked once for the organization, not once per survey.
    expect(getIsCustomCssRolledOut).toHaveBeenCalledTimes(1);
    expect(getIsCustomCssRolledOut).toHaveBeenCalledWith("org-1");
  });

  test("asks nothing when the workspace and its surveys have no CSS at all", async () => {
    const result = await resolveRespondentCustomCss({
      organizationId: "org-1",
      workspaceCustomCss: null,
      surveys: [{ id: "s1", customCss: null }, { id: "s2" }],
    });

    expect(result.workspace).toBeUndefined();
    expect(result.surveys.size).toBe(0);
    expect(getIsCustomCssRolledOut).not.toHaveBeenCalled();
    expect(toDeliveredCustomCss).not.toHaveBeenCalled();
  });

  test("withholds every scope when the rollout is off, or its check fails, without touching storage", async () => {
    vi.mocked(getIsCustomCssRolledOut).mockResolvedValueOnce(false);
    const off = await resolveRespondentCustomCss({
      organizationId: "org-1",
      workspaceCustomCss: stored(".w{}"),
      surveys: [{ id: "s1", customCss: stored(".s1{}") }],
    });

    vi.mocked(getIsCustomCssRolledOut).mockRejectedValueOnce(new Error("posthog down"));
    const failing = await resolveRespondentCustomCss({
      organizationId: "org-1",
      workspaceCustomCss: stored(".w{}"),
      surveys: [],
    });

    for (const result of [off, failing]) {
      expect(result.workspace).toBeUndefined();
      expect(result.surveys.size).toBe(0);
    }
    expect(toDeliveredCustomCss).not.toHaveBeenCalled();
  });

  test("a scope delivery withholds or that throws is omitted; the others still go out", async () => {
    vi.mocked(toDeliveredCustomCss).mockImplementation(async (value, scope) => {
      if (scope === "workspace") throw new Error("reprocessing failed");
      if (value?.light?.source.includes(".stale")) return undefined;
      return deliverCompiled(value);
    });

    const result = await resolveRespondentCustomCss({
      organizationId: "org-1",
      workspaceCustomCss: stored(".w{}"),
      surveys: [
        { id: "s1", customCss: stored(".stale{}") },
        { id: "s2", customCss: stored(".s2{}") },
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
      organizationId: "org-1",
      workspaceCustomCss: stored(".w{}"),
      surveys: [],
    });

    expect(result.workspace).toEqual({ light: "@layer fb-workspace {}" });
  });
});

describe("getLinkSurveyCustomCss", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getIsCustomCssRolledOut).mockResolvedValue(true);
    vi.mocked(toDeliveredCustomCss).mockImplementation(deliverCompiled);
  });

  test("builds the renderer prop with only the scopes that have CSS", async () => {
    await expect(
      getLinkSurveyCustomCss({
        organizationId: "org-1",
        workspaceCustomCss: null,
        surveyId: "s1",
        surveyCustomCss: stored(".s{}"),
      })
    ).resolves.toEqual({ survey: { light: "@layer fb-x { .s{} }" } });

    await expect(
      getLinkSurveyCustomCss({
        organizationId: "org-1",
        workspaceCustomCss: stored(".w{}"),
        surveyId: "s1",
        surveyCustomCss: stored(".s{}"),
      })
    ).resolves.toEqual({
      workspace: { light: "@layer fb-x { .w{} }" },
      survey: { light: "@layer fb-x { .s{} }" },
    });
  });

  test("returns nothing when neither scope has CSS to deliver", async () => {
    await expect(
      getLinkSurveyCustomCss({
        organizationId: "org-1",
        workspaceCustomCss: null,
        surveyId: "s1",
        surveyCustomCss: undefined,
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
