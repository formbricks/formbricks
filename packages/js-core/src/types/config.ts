type TJsonObject = Record<string, unknown>;

export type TActionClassPageUrlRule =
  | "exactMatch"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "notMatch"
  | "notContains"
  | "matchesRegex";

export type TActionClassNoCodeConfig =
  | {
      type: "click";
      urlFilters: { value: string; rule: TActionClassPageUrlRule }[];
      urlFiltersConnector?: "or" | "and";
      elementSelector: {
        cssSelector?: string;
        innerHtml?: string;
      };
    }
  | {
      type: "pageView" | "exitIntent" | "fiftyPercentScroll";
      urlFilters: { value: string; rule: TActionClassPageUrlRule }[];
      urlFiltersConnector?: "or" | "and";
    }
  | {
      type: "pageDwell";
      urlFilters: { value: string; rule: TActionClassPageUrlRule }[];
      urlFiltersConnector?: "or" | "and";
      timeInSeconds: number;
    };

interface TWorkspaceStateLanguage {
  surveyId?: string;
  languageId?: string;
  language: {
    id?: string;
    code: string;
    alias?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    workspaceId?: string;
  };
  default: boolean;
  enabled: boolean;
}

export interface TWorkspaceStateActionClass {
  id: string;
  key: string | null;
  type: "code" | "noCode";
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
  workspaceId?: string;
  description?: string | null;
  noCodeConfig: TActionClassNoCodeConfig | null;
}

export interface TWorkspaceStateSurvey {
  id: string;
  // name intentionally omitted: internal label, not needed by SDK
  welcomeCard: TJsonObject | null;
  questions: TJsonObject[];
  variables: TJsonObject[];
  type: "link" | "app";
  showLanguageSwitch: boolean | null;
  endings: TJsonObject[];
  autoClose: number | null;
  status: "draft" | "inProgress" | "paused" | "completed";
  recontactDays: number | null;
  displayLimit: number | null;
  displayOption: "displayOnce" | "displayMultiple" | "displaySome" | "respondMultiple";
  hiddenFields: {
    enabled: boolean;
    fieldIds?: string[];
  };
  delay: number;
  workspaceOverwrites: {
    clickOutsideClose?: boolean | null;
    overlay?: "none" | "light" | "dark" | null;
    placement?: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center" | null;
  } | null;
  isBackButtonHidden: boolean;
  isAutoProgressingEnabled: boolean;
  recaptcha: {
    enabled: boolean;
    threshold?: number;
  } | null;
  languages: TWorkspaceStateLanguage[];
  triggers: { actionClass: TWorkspaceStateActionClass }[];
  // Minimal segment shape; full filter logic is evaluated server-side and must not reach the browser.
  segment?: { id: string; hasFilters: boolean };
  displayPercentage: number | null;
  styling?: TSurveyStyling;
}

export interface TWorkspaceStateSettings {
  recontactDays: number;
  clickOutsideClose: boolean;
  overlay: "none" | "light" | "dark";
  placement: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
  inAppSurveyBranding: boolean;
  styling: TWorkspaceStyling;
}

export interface TWorkspaceState {
  expiresAt: Date;
  data: {
    surveys: TWorkspaceStateSurvey[];
    actionClasses: TWorkspaceStateActionClass[];
    settings: TWorkspaceStateSettings;
    recaptchaSiteKey?: string;
  };
}

export interface TUserState {
  expiresAt: Date | null;
  data: {
    userId: string | null;
    contactId: string | null;
    segments: string[];
    displays: { surveyId: string; createdAt: Date }[];
    responses: string[];
    lastDisplayAt: Date | null;
    language?: string;
  };
}

export interface TConfig {
  workspaceId: string;
  appUrl: string;
  workspace: TWorkspaceState;
  user: TUserState;
  filteredSurveys: TWorkspaceStateSurvey[];
  status: {
    value: "success" | "error";
    expiresAt: Date | null;
  };
}

export type TConfigUpdateInput = Omit<TConfig, "status"> & {
  status?: {
    value: "success" | "error";
    expiresAt: Date | null;
  };
};

export type TAttributes = Record<string, string | number>;

export interface TConfigInput {
  /** @deprecated Use `workspaceId` instead. Still works as a backward-compatible alias. */
  environmentId?: string;
  workspaceId?: string;
  appUrl: string;
}

export interface TStylingColor {
  light: string;
  dark?: string | null;
}

type TDimension = number | string | null;

export interface TBaseStyling {
  brandColor?: TStylingColor | null;
  accentBgColor?: TStylingColor | null;
  accentBgColorSelected?: TStylingColor | null;
  fontFamily?: string | null;

  // Buttons
  buttonBgColor?: TStylingColor | null;
  buttonTextColor?: TStylingColor | null;
  buttonBorderRadius?: TDimension;
  buttonHeight?: TDimension;
  buttonFontSize?: TDimension;
  buttonFontWeight?: TDimension;
  buttonPaddingX?: TDimension;
  buttonPaddingY?: TDimension;

  // Inputs
  inputBgColor?: TStylingColor | null;
  inputBorderColor?: TStylingColor | null;
  inputBorderRadius?: TDimension;
  inputHeight?: TDimension;
  inputTextColor?: TStylingColor | null;
  inputFontSize?: TDimension;
  inputPlaceholderOpacity?: number | null;
  inputPaddingX?: TDimension;
  inputPaddingY?: TDimension;
  inputShadow?: string | null;

  // Options
  optionBgColor?: TStylingColor | null;
  optionLabelColor?: TStylingColor | null;
  optionBorderColor?: TStylingColor | null;
  optionBorderRadius?: TDimension;
  optionPaddingX?: TDimension;
  optionPaddingY?: TDimension;
  optionFontSize?: TDimension;

  // Headlines & Descriptions
  elementHeadlineFontSize?: TDimension;
  elementHeadlineFontWeight?: TDimension;
  elementHeadlineColor?: TStylingColor | null;
  elementDescriptionFontSize?: TDimension;
  elementDescriptionFontWeight?: TDimension;
  elementDescriptionColor?: TStylingColor | null;
  elementUpperLabelFontSize?: TDimension;
  elementUpperLabelColor?: TStylingColor | null;
  elementUpperLabelFontWeight?: TDimension;

  // Progress Bar
  progressTrackHeight?: TDimension;
  progressTrackBgColor?: TStylingColor | null;
  progressIndicatorBgColor?: TStylingColor | null;

  cardBackgroundColor?: TStylingColor | null;
  cardBorderColor?: TStylingColor | null;
  highlightBorderColor?: TStylingColor | null;
  isDarkModeEnabled?: boolean | null;
  roundness?: TDimension;
  cardArrangement?: {
    // "cardless" is only supported for link surveys.
    linkSurveys: "casual" | "straight" | "simple" | "cardless";
    appSurveys: "casual" | "straight" | "simple";
  } | null;
  linkSurveyCardWidth?: "narrow" | "default" | "wide" | null;
  background?: {
    bg?: string | null;
    bgType?: "animation" | "color" | "image" | "upload" | null;
    brightness?: number | null;
  } | null;
  hideProgressBar?: boolean | null;
  isLogoHidden?: boolean | null;
}

export interface TWorkspaceStyling extends TBaseStyling {
  allowStyleOverwrite: boolean;
}

export interface TSurveyStyling extends TBaseStyling {
  overwriteThemeStyling?: boolean | null;
}

export interface TUpdates {
  userId: string;
  attributes?: TAttributes;
}

export interface TLegacyConfigInput {
  apiHost: string;
  environmentId: string;
  userId?: string;
  attributes?: Record<string, string>;
}

export type TLegacyConfig = TConfig & {
  apiHost?: string;
  attributes?: TAttributes;
  // Intermediate format fields (pre-workspace rename)
  environmentId?: string;
  environment?: TWorkspaceState;
};
