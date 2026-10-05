// @vitest-environment happy-dom
import { useContext } from "preact/hooks";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TRendererCustomCss } from "@formbricks/types/custom-css";
import type { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";

// What the survey tree sees: the portal container its dropdowns would mount in.
const seen = vi.hoisted(() => ({ portalContainer: undefined as HTMLElement | null | undefined }));

vi.mock("@formbricks/survey-ui", async () => {
  const { createContext } = await import("preact");
  return { SurveyPortalContainerContext: createContext<HTMLElement | null>(null) };
});
vi.mock("@/components/general/render-survey", async () => {
  const { SurveyPortalContainerContext } = await import("@formbricks/survey-ui");
  return {
    RenderSurvey: () => {
      seen.portalContainer = useContext(SurveyPortalContainerContext as never);
      return null;
    },
  };
});
vi.mock("@/components/i18n/provider", () => ({
  I18nProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/lib/styles", () => ({
  addStylesToDom: vi.fn(),
  addCustomThemeToDom: vi.fn(),
  setStyleNonce: vi.fn(),
}));
vi.mock("@/lib/custom-css", () => ({ applyCustomCss: vi.fn(), syncCustomCssNonce: vi.fn() }));
vi.mock("@/lib/i18n.config", () => ({ setLocaleBaseUrl: vi.fn() }));
vi.mock("@/lib/i18n-utils", () => ({ getI18nLanguage: () => "en" }));
vi.mock("@/lib/appearance", () => ({ setAppearance: vi.fn() }));

const { renderSurvey, setNonce } = await import("./index");
const { applyCustomCss, syncCustomCssNonce } = await import("@/lib/custom-css");
const { setStyleNonce } = await import("@/lib/styles");

const COMPILED: TRendererCustomCss = {
  workspace: { light: "@layer fb-workspace { #fbjs { color: red !important } }" },
  survey: { light: "@layer fb-survey { #fbjs { color: blue !important } }" },
};

const renderInline = (overrides: Partial<SurveyContainerProps> = {}) =>
  renderSurvey({
    mode: "inline",
    containerId: "survey-container",
    languageCode: "default",
    styling: {},
    isBrandingEnabled: false,
    survey: { id: "survey-1", type: "link", languages: [] },
    ...overrides,
  } as unknown as SurveyContainerProps);

beforeEach(() => {
  vi.clearAllMocks();
  seen.portalContainer = undefined;
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderSurvey custom CSS", () => {
  test("applies exactly the explicit customCss prop", () => {
    document.body.innerHTML = '<div id="survey-container"></div>';

    renderInline({ customCss: COMPILED });

    expect(applyCustomCss).toHaveBeenCalledWith(COMPILED);
  });

  test("never falls back to CSS carried on the survey or styling objects (old SDKs pass no prop)", () => {
    document.body.innerHTML = '<div id="survey-container"></div>';

    renderInline({
      survey: { id: "survey-1", type: "app", languages: [], customCss: COMPILED.survey },
      styling: { customCss: COMPILED.workspace },
    } as unknown as Partial<SurveyContainerProps>);

    // Called — so stale CSS from an earlier survey is cleared — but with nothing to apply.
    expect(applyCustomCss).toHaveBeenCalledWith(undefined);
  });

  test("the host's late CSP nonce reaches the custom CSS elements too", () => {
    setNonce("late-nonce");

    expect(setStyleNonce).toHaveBeenCalledWith("late-nonce");
    expect(syncCustomCssNonce).toHaveBeenCalled();
  });
});

describe("renderSurvey dropdown portal container", () => {
  test("a dashboard preview mounts dropdowns in its contained boundary", () => {
    document.body.innerHTML =
      '<div data-fb-preview-boundary id="boundary"><div><div id="survey-container"></div></div></div>';

    renderInline({ isPreviewMode: true });

    expect(seen.portalContainer).toBe(document.getElementById("boundary"));
  });

  test("respondent surfaces keep mounting dropdowns in <body>", () => {
    // Even inside a marked box, a non-preview render (a real link survey) does not opt in.
    document.body.innerHTML = '<div data-fb-preview-boundary><div id="survey-container"></div></div>';
    renderInline({ isPreviewMode: false });
    expect(seen.portalContainer).toBeNull();

    // And a preview render with no boundary around it (e.g. the link page's ?preview=true) neither.
    document.body.innerHTML = '<div id="survey-container"></div>';
    renderInline({ isPreviewMode: true });
    expect(seen.portalContainer).toBeNull();
  });
});
