/* eslint-disable import/no-extraneous-dependencies -- required for Prisma types */
import type { ActionClass, Language, Segment, Survey, SurveyLanguage, Workspace } from "@prisma/client";

export type TWorkspaceStateSurvey = Pick<
  Survey,
  | "id"
  | "name"
  | "welcomeCard"
  | "questions"
  | "variables"
  | "type"
  | "showLanguageSwitch"
  | "endings"
  | "autoClose"
  | "status"
  | "recontactDays"
  | "displayLimit"
  | "displayOption"
  | "hiddenFields"
  | "delay"
  | "workspaceOverwrites"
  | "isBackButtonHidden"
  | "isAutoProgressingEnabled"
  | "recaptcha"
> & {
  languages: (SurveyLanguage & { language: Language })[];
  triggers: { actionClass: ActionClass }[];
  segment?: Segment;
  displayPercentage: number;
  type: "link" | "app";
  styling?: TSurveyStyling;
};

export type TWorkspaceStateSettings = Pick<
  Workspace,
  "recontactDays" | "clickOutsideClose" | "overlay" | "placement" | "inAppSurveyBranding"
> & {
  styling: TWorkspaceStyling;
};

export type TWorkspaceStateActionClass = Pick<ActionClass, "id" | "key" | "type" | "name" | "noCodeConfig">;

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
  dark?: string | null | undefined;
}

export interface TBaseStyling {
  brandColor?: TStylingColor | null;
  accentBgColor?: TStylingColor | null;
  accentBgColorSelected?: TStylingColor | null;
  fontFamily?: string | null;

  // Buttons
  buttonBgColor?: TStylingColor | null;
  buttonTextColor?: TStylingColor | null;
  buttonBorderRadius?: number | string | null;
  buttonHeight?: number | string | null;
  buttonFontSize?: number | string | null;
  buttonFontWeight?: string | number | null;
  buttonPaddingX?: number | string | null;
  buttonPaddingY?: number | string | null;

  // Inputs
  inputBgColor?: TStylingColor | null;
  inputBorderColor?: TStylingColor | null;
  inputBorderRadius?: number | string | null;
  inputHeight?: number | string | null;
  inputTextColor?: TStylingColor | null;
  inputFontSize?: number | string | null;
  inputPlaceholderOpacity?: number | null;
  inputPaddingX?: number | string | null;
  inputPaddingY?: number | string | null;
  inputShadow?: string | null;

  // Options
  optionBgColor?: TStylingColor | null;
  optionLabelColor?: TStylingColor | null;
  optionBorderColor?: TStylingColor | null;
  optionBorderRadius?: number | string | null;
  optionPaddingX?: number | string | null;
  optionPaddingY?: number | string | null;
  optionFontSize?: number | string | null;

  // Headlines & Descriptions
  elementHeadlineFontSize?: number | string | null;
  elementHeadlineFontWeight?: string | number | null;
  elementHeadlineColor?: TStylingColor | null;
  elementDescriptionFontSize?: number | string | null;
  elementDescriptionFontWeight?: string | number | null;
  elementDescriptionColor?: TStylingColor | null;
  elementUpperLabelFontSize?: number | string | null;
  elementUpperLabelColor?: TStylingColor | null;
  elementUpperLabelFontWeight?: string | number | null;

  // Progress Bar
  progressTrackHeight?: number | string | null;
  progressTrackBgColor?: TStylingColor | null;
  progressIndicatorBgColor?: TStylingColor | null;

  cardBackgroundColor?: TStylingColor | null;
  cardBorderColor?: TStylingColor | null;
  highlightBorderColor?: TStylingColor | null;
  isDarkModeEnabled?: boolean | null;
  roundness?: number | string | null;
  cardArrangement?: {
    linkSurveys: "casual" | "straight" | "simple";
    appSurveys: "casual" | "straight" | "simple";
  } | null;
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
