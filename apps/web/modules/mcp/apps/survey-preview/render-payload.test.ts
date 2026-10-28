import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TWorkspaceStyling } from "@formbricks/types/workspace";
import {
  buildSurveyPreviewMeta,
  computeSurveyStyling,
  getSurveyPreviewProblems,
  getSurveyPreviewUiMeta,
  getSurveyPublicUrl,
  getSurveysScriptUrl,
  toPreviewSurvey,
} from "./render-payload";

const workspaceStyling = { allowStyleOverwrite: true, brandColor: { light: "#111111" } } as TWorkspaceStyling;

const makeSurvey = (overrides: Record<string, unknown> = {}): TSurvey =>
  ({
    id: "clsurvey1",
    name: "Feedback",
    type: "link",
    status: "inProgress",
    workspaceId: "clworkspace1",
    welcomeCard: { enabled: false },
    questions: [],
    blocks: [{ id: "b1", name: "First", elements: [] }],
    endings: [],
    variables: [],
    hiddenFields: { enabled: false },
    languages: [],
    showLanguageSwitch: false,
    autoSelectLanguage: false,
    autoClose: null,
    keepEndingCardOpen: false,
    styling: null,
    segment: null,
    recontactDays: null,
    displayLimit: null,
    displayOption: "displayOnce",
    triggers: [],
    displayPercentage: null,
    delay: 0,
    workspaceOverwrites: null,
    isBackButtonHidden: false,
    isAutoProgressingEnabled: false,
    recaptcha: { enabled: true, threshold: 0.5 },
    showConditions: null,
    pin: "1234",
    customCss: { source: "body{}", compiled: {}, processorVersion: 1 },
    followUps: [{ id: "f1", to: "secret@example.com" }],
    isVerifyEmailEnabled: false,
    singleUse: null,
    autoComplete: null,
    publishOn: null,
    closeOn: null,
    ...overrides,
  }) as unknown as TSurvey;

describe("getSurveyPreviewUiMeta", () => {
  test("declares only the instance origins, and connect only for the locale bundles on the public domain", () => {
    const meta = getSurveyPreviewUiMeta("https://app.example.com/", "https://surveys.example.com/base/path");
    expect(meta.csp).toEqual({
      resourceDomains: ["https://surveys.example.com", "https://app.example.com"],
      connectDomains: ["https://surveys.example.com"],
    });
  });

  test("lists one origin once when the public domain is the web app URL", () => {
    const meta = getSurveyPreviewUiMeta("https://app.example.com", "https://app.example.com");
    expect(meta.csp?.resourceDomains).toEqual(["https://app.example.com"]);
  });

  test("never declares a domain that does not parse", () => {
    const meta = getSurveyPreviewUiMeta("not a url", "https://app.example.com");
    expect(meta.csp?.resourceDomains).toEqual(["https://app.example.com"]);
  });

  test("declares no frame or base-uri domains", () => {
    const meta = getSurveyPreviewUiMeta("https://a.example.com", "https://b.example.com");
    expect(meta.csp).not.toHaveProperty("frameDomains");
    expect(meta.csp).not.toHaveProperty("baseUriDomains");
  });
});

describe("toPreviewSurvey", () => {
  test("never carries the PIN, the custom CSS source or follow-up recipients", () => {
    const serialized = JSON.stringify(toPreviewSurvey(makeSurvey()));
    expect(serialized).not.toContain("1234");
    expect(serialized).not.toContain("body{}");
    expect(serialized).not.toContain("secret@example.com");
    expect(serialized).not.toContain('"pin"');
    expect(serialized).not.toContain("customCss");
  });

  test("turns captcha off and reduces the segment to the SDK shape", () => {
    const preview = toPreviewSurvey(
      makeSurvey({ segment: { id: "s1", title: "Everyone", filters: [{}], workspaceId: "w" } })
    );
    expect(preview.recaptcha).toBeNull();
    expect(preview.segment).toEqual({ id: "s1", hasFilters: true });
  });
});

describe("computeSurveyStyling", () => {
  const surveyStyling = { overwriteThemeStyling: true } as never;

  test("uses the survey's own styling only when the workspace allows it and the survey opts in", () => {
    expect(computeSurveyStyling(workspaceStyling, surveyStyling)).toBe(surveyStyling);
    expect(computeSurveyStyling(workspaceStyling, { overwriteThemeStyling: false } as never)).toBe(workspaceStyling);
    expect(computeSurveyStyling({ ...workspaceStyling, allowStyleOverwrite: false }, surveyStyling)).toEqual({
      ...workspaceStyling,
      allowStyleOverwrite: false,
    });
  });
});

describe("getSurveyPublicUrl", () => {
  test("is the public link of a link survey that is taking responses", () => {
    expect(getSurveyPublicUrl(makeSurvey(), "https://app.example.com/")).toBe("https://app.example.com/s/clsurvey1");
  });

  test("is null for app, draft, paused and archived surveys", () => {
    expect(getSurveyPublicUrl(makeSurvey({ type: "app" }), "https://a")).toBeNull();
    expect(getSurveyPublicUrl(makeSurvey({ status: "draft" }), "https://a")).toBeNull();
    expect(getSurveyPublicUrl(makeSurvey({ status: "paused" }), "https://a")).toBeNull();
    expect(getSurveyPublicUrl(makeSurvey({ archivedAt: new Date() }), "https://a")).toBeNull();
  });
});

describe("getSurveysScriptUrl", () => {
  test("versions the renderer like the link page does", () => {
    expect(getSurveysScriptUrl("https://app.example.com/", "5.1.0")).toBe(
      "https://app.example.com/js/surveys.umd.cjs?v=5.1.0"
    );
    expect(getSurveysScriptUrl("https://app.example.com", undefined)).toBe(
      "https://app.example.com/js/surveys.umd.cjs"
    );
  });
});

describe("getSurveyPreviewProblems", () => {
  test("flags a live app survey nothing triggers, and a survey without questions", () => {
    expect(getSurveyPreviewProblems(makeSurvey({ type: "app" }))).toEqual([
      expect.stringContaining("no trigger"),
    ]);
    expect(getSurveyPreviewProblems(makeSurvey({ blocks: [] }))).toEqual(["This survey has no questions yet."]);
  });

  test("is empty for a healthy survey, and for an app draft without triggers", () => {
    expect(getSurveyPreviewProblems(makeSurvey())).toEqual([]);
    expect(getSurveyPreviewProblems(makeSurvey({ type: "app", status: "draft" }))).toEqual([]);
  });
});

describe("buildSurveyPreviewMeta", () => {
  test("assembles the renderer inputs, the settings and the link", () => {
    const meta = buildSurveyPreviewMeta({
      survey: makeSurvey({ pin: "1234", autoComplete: 100 }),
      workspace: { styling: workspaceStyling, linkSurveyBranding: true },
      customCss: { workspace: { light: "a{}" } },
      publicDomain: "https://app.example.com/",
      releaseVersion: "5.1.0",
    });
    expect(meta.appUrl).toBe("https://app.example.com");
    expect(meta.rendererUrl).toBe("https://app.example.com/js/surveys.umd.cjs?v=5.1.0");
    expect(meta.surveyUrl).toBe("https://app.example.com/s/clsurvey1");
    expect(meta.render.styling).toBe(workspaceStyling);
    expect(meta.render.isBrandingEnabled).toBe(true);
    expect(meta.render.customCss).toEqual({ workspace: { light: "a{}" } });
    expect(meta.settings).toMatchObject({ pinProtected: true, autoComplete: 100 });
  });

  test("previews an app survey without the badge", () => {
    const meta = buildSurveyPreviewMeta({
      survey: makeSurvey({ type: "app", triggers: [{ actionClass: { name: "Open", type: "code" } }] }),
      workspace: { styling: workspaceStyling, linkSurveyBranding: true },
      publicDomain: "https://app.example.com",
      releaseVersion: undefined,
    });
    expect(meta.render.isBrandingEnabled).toBe(false);
    expect(meta.settings.triggers).toEqual([{ name: "Open", type: "code" }]);
    expect(meta.render).not.toHaveProperty("customCss");
  });
});
