/**
 * What `show_survey` sends the view (apps/web/modules/mcp/apps/survey-preview). The survey itself is the v3
 * resource `get_survey` returns, in `structuredContent.data`; the renderer's inputs and the settings the
 * review tab reports ride in `_meta.formbricks`. Every field is read defensively: the view renders what it
 * recognises and says so when it does not.
 */

/** A translatable string: language code (or `default`) to text. */
export type I18nString = Record<string, string>;

export interface SurveyLanguage {
  code: string;
  default: boolean;
  enabled: boolean;
  alias?: string;
}

export type JsonRecord = Record<string, unknown>;

/** The v3 survey resource, narrowed to what the review tab reads. Blocks and endings stay loose. */
export interface SurveyDocument {
  id: string;
  name: string;
  type: string;
  status: string;
  defaultLanguage: string;
  languages: SurveyLanguage[];
  showLanguageSwitch: boolean | null;
  welcomeCard: JsonRecord | null;
  blocks: JsonRecord[];
  endings: JsonRecord[];
  hiddenFields: JsonRecord | null;
  variables: JsonRecord[];
  distribution: JsonRecord | null;
  targeting: JsonRecord | null;
  visibility: string | null;
}

export interface PreviewSettings {
  publishOn: string | null;
  closeOn: string | null;
  autoComplete: number | null;
  pinProtected: boolean;
  verifyEmail: boolean;
  singleUse: boolean;
  backButtonHidden: boolean;
  autoProgress: boolean;
  triggers: { name: string; type: string }[];
  segment: { title: string; filterCount: number } | null;
  displayOption: string;
  displayPercentage: number | null;
  displayLimit: number | null;
  recontactDays: number | null;
  delaySeconds: number;
  autoCloseSeconds: number | null;
}

export interface RenderSurveyLanguage {
  default: boolean;
  enabled: boolean;
  language: { code: string };
}

/** The props the renderer takes that the server decides; the rest are the view's own. */
export interface RenderPayload {
  survey: JsonRecord & { type: string; languages: RenderSurveyLanguage[] };
  styling: JsonRecord;
  isBrandingEnabled: boolean;
  customCss?: JsonRecord;
}

export interface PreviewMeta {
  appUrl: string;
  rendererUrl: string;
  surveyUrl: string | null;
  render: RenderPayload;
  settings: PreviewSettings;
  problems: string[];
}

export interface ShowSurveyData {
  survey: SurveyDocument;
  meta: PreviewMeta | null;
  /** Warnings the tool result carries next to the survey, if any. */
  warnings: string[];
}
