import type { TRendererCustomCss } from "@formbricks/types/custom-css";
import type { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import type { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
import type { TWorkspaceStyling } from "@formbricks/types/workspace";
import type { McpUiResourceMeta } from "../constants";

/**
 * What the survey preview view needs on top of the v3 survey that `structuredContent` carries: the
 * internal survey shape the respondent renderer consumes, its styling and compiled custom CSS, where to
 * load the renderer from, and the settings the review tab reports. It rides in `_meta.formbricks`, which
 * ChatGPT keeps away from the model: it is bulky and of no use to anything but the view.
 *
 * Everything in here is derived from a survey the caller was already authorized to read (the v3 `get`
 * operation runs first), and nothing a respondent could not already receive: no PIN, no custom CSS
 * source, no follow-ups.
 */
export interface TSurveyPreviewMeta {
  /** The deployment the renderer and its locale bundles come from: the public domain, as link surveys use. */
  appUrl: string;
  /** `<appUrl>/js/surveys.umd.cjs`, the file SDK customers load, versioned like the link page does. */
  rendererUrl: string;
  /** The public link, only for a link survey that is taking responses. */
  surveyUrl: string | null;
  render: {
    survey: TJsPreviewSurvey;
    styling: TWorkspaceStyling | TSurveyStyling;
    isBrandingEnabled: boolean;
    customCss?: TRendererCustomCss;
  };
  settings: TSurveyPreviewSettings;
  /** Things worth fixing before the survey goes live; empty for a healthy survey. */
  problems: string[];
}

/** The SDK's survey state shape, with the PIN-less, CSS-source-less guarantees above. */
export type TJsPreviewSurvey = Omit<TJsWorkspaceStateSurvey, "customCss">;

export interface TSurveyPreviewSettings {
  publishOn: string | null;
  closeOn: string | null;
  /** The response limit that closes the survey; `null` for none. */
  autoComplete: number | null;
  pinProtected: boolean;
  verifyEmail: boolean;
  singleUse: boolean;
  backButtonHidden: boolean;
  autoProgress: boolean;
  /** App surveys: what shows the survey and to whom. */
  triggers: { name: string; type: string }[];
  segment: { title: string; filterCount: number } | null;
  /** The survey's own showing rules: how often, and after how long. */
  displayOption: string;
  displayPercentage: number | null;
  displayLimit: number | null;
  recontactDays: number | null;
  delaySeconds: number;
  autoCloseSeconds: number | null;
}

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * The origin of a configured URL, or `undefined` when it does not parse. CSP source expressions are
 * origins: a path or trailing slash in `WEBAPP_URL` would otherwise produce a source the host ignores.
 */
export const toOrigin = (url: string): string | undefined => {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

const unique = (values: (string | undefined)[]): string[] => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];

/**
 * The `_meta.ui` of the preview view's resource.
 *
 * - `resourceDomains`: the renderer script (public domain, where `appUrl` points), and the survey's own
 *   images, which live under `/storage/` of the public domain (public files) or the web app URL
 *   (private ones). Both origins, nothing else: an image a survey author links from a third-party host
 *   is blocked by the host's CSP and the renderer shows it as missing, which is the safe failure.
 * - `connectDomains`: the public domain only, for the one request the renderer makes in preview mode:
 *   the UI strings of a non-English survey language (`/js/locales/<bundle>.json`). A preview never talks
 *   to the response API: it creates no display and no response. Without this a translated survey would
 *   show English buttons and validation messages.
 */
export const getSurveyPreviewUiMeta = (webappUrl: string, publicDomain: string): McpUiResourceMeta => {
  const publicOrigin = toOrigin(publicDomain);
  return {
    csp: {
      resourceDomains: unique([publicOrigin, toOrigin(webappUrl)]),
      connectDomains: unique([publicOrigin]),
    },
    prefersBorder: false,
  };
};

/** Styling exactly as the link page resolves it: the survey's own only when the workspace allows it. */
export const computeSurveyStyling = (
  workspaceStyling: TWorkspaceStyling,
  surveyStyling: TSurveyStyling | null | undefined
): TWorkspaceStyling | TSurveyStyling => {
  if (!workspaceStyling.allowStyleOverwrite) return workspaceStyling;
  return surveyStyling?.overwriteThemeStyling ? surveyStyling : workspaceStyling;
};

/**
 * The survey as the renderer takes it: the SDK state shape, picked key by key. Spreading the stored
 * survey instead would hand the view the PIN, the custom CSS source and the follow-up emails.
 */
export const toPreviewSurvey = (survey: TSurvey): TJsPreviewSurvey => ({
  id: survey.id,
  name: survey.name,
  welcomeCard: survey.welcomeCard,
  questions: survey.questions,
  blocks: survey.blocks,
  variables: survey.variables,
  type: survey.type,
  showLanguageSwitch: survey.showLanguageSwitch,
  autoSelectLanguage: survey.autoSelectLanguage,
  languages: survey.languages,
  endings: survey.endings,
  autoClose: survey.autoClose,
  keepEndingCardOpen: survey.keepEndingCardOpen,
  styling: survey.styling,
  status: survey.status,
  segment: survey.segment ? { id: survey.segment.id, hasFilters: survey.segment.filters.length > 0 } : null,
  recontactDays: survey.recontactDays,
  displayLimit: survey.displayLimit,
  displayOption: survey.displayOption,
  hiddenFields: survey.hiddenFields,
  embeddedFields: survey.embeddedFields,
  triggers: survey.triggers,
  displayPercentage: survey.displayPercentage,
  delay: survey.delay,
  workspaceOverwrites: survey.workspaceOverwrites,
  isBackButtonHidden: survey.isBackButtonHidden,
  isAutoProgressingEnabled: survey.isAutoProgressingEnabled,
  // The preview never solves a captcha, and the renderer skips it in preview mode regardless.
  recaptcha: null,
  showConditions: survey.showConditions,
});

export const toPreviewSettings = (survey: TSurvey): TSurveyPreviewSettings => ({
  publishOn: toIso(survey.publishOn),
  closeOn: toIso(survey.closeOn),
  autoComplete: survey.autoComplete ?? null,
  pinProtected: Boolean(survey.pin),
  verifyEmail: survey.isVerifyEmailEnabled,
  singleUse: Boolean(survey.singleUse?.enabled),
  backButtonHidden: survey.isBackButtonHidden,
  autoProgress: Boolean(survey.isAutoProgressingEnabled),
  triggers: survey.triggers.filter(Boolean).map(({ actionClass }) => ({
    name: actionClass.name,
    type: actionClass.type,
  })),
  segment: survey.segment
    ? { title: survey.segment.title, filterCount: survey.segment.filters.length }
    : null,
  displayOption: survey.displayOption,
  displayPercentage: survey.displayPercentage ?? null,
  displayLimit: survey.displayLimit ?? null,
  recontactDays: survey.recontactDays ?? null,
  delaySeconds: survey.delay,
  autoCloseSeconds: survey.autoClose ?? null,
});

/**
 * Problems worth a banner, kept to facts a person can act on without a second opinion. A live app survey
 * with no trigger never shows, which `validate_survey` does not flag on a stored survey.
 */
export const getSurveyPreviewProblems = (survey: TSurvey): string[] => {
  const problems: string[] = [];
  const hasTrigger = survey.triggers.filter(Boolean).length > 0;
  if (survey.type === "app" && survey.status !== "draft" && !hasTrigger) {
    problems.push(
      "This app survey has no trigger, so it never shows unless a creative opens it. Add a trigger before it goes live."
    );
  }
  if (survey.blocks.length === 0) {
    problems.push("This survey has no questions yet.");
  }
  return problems;
};

/** The public link of a survey a respondent can open now: a link survey that is in progress. */
export const getSurveyPublicUrl = (survey: TSurvey, publicDomain: string): string | null =>
  survey.type === "link" && survey.status === "inProgress" && !survey.archivedAt
    ? `${publicDomain.replace(/\/+$/, "")}/s/${survey.id}`
    : null;

export const getSurveysScriptUrl = (appUrl: string, releaseVersion: string | undefined): string => {
  const url = `${appUrl.replace(/\/+$/, "")}/js/surveys.umd.cjs`;
  return releaseVersion ? `${url}?v=${encodeURIComponent(releaseVersion)}` : url;
};

export const buildSurveyPreviewMeta = ({
  survey,
  workspace,
  customCss,
  publicDomain,
  releaseVersion,
}: {
  survey: TSurvey;
  workspace: { styling: TWorkspaceStyling; linkSurveyBranding: boolean };
  customCss?: TRendererCustomCss;
  publicDomain: string;
  releaseVersion: string | undefined;
}): TSurveyPreviewMeta => {
  const appUrl = publicDomain.replace(/\/+$/, "");
  return {
    appUrl,
    rendererUrl: getSurveysScriptUrl(appUrl, releaseVersion),
    surveyUrl: getSurveyPublicUrl(survey, appUrl),
    render: {
      survey: toPreviewSurvey(survey),
      styling: computeSurveyStyling(workspace.styling, survey.styling),
      // The in-app branding switch is not loaded here: a link survey follows its own, an app survey
      // previews without the badge.
      isBrandingEnabled: survey.type === "link" && workspace.linkSurveyBranding,
      ...(customCss ? { customCss } : {}),
    },
    settings: toPreviewSettings(survey),
    problems: getSurveyPreviewProblems(survey),
  };
};
