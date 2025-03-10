/* eslint-disable import/no-extraneous-dependencies -- required for Prisma types */
import type { ActionClass, Language, Project, Segment, Survey, SurveyLanguage } from "@prisma/client";
import { z } from "zod";
import { type TResponseUpdate } from "@/types/response";
import { type TFileUploadParams } from "@/types/storage";

export type TEnvironmentStateSurvey = Pick<
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
  | "projectOverwrites"
> & {
  languages: (SurveyLanguage & { language: Language })[];
  triggers: { actionClass: ActionClass }[];
  segment?: Segment;
  displayPercentage: number;
  type: "link" | "app";
  styling?: TSurveyStyling;
};

export type TEnvironmentStateProject = Pick<
  Project,
  "id" | "recontactDays" | "clickOutsideClose" | "darkOverlay" | "placement" | "inAppSurveyBranding"
> & {
  styling: TProjectStyling;
};

export type TEnvironmentStateActionClass = Pick<ActionClass, "id" | "key" | "type" | "name" | "noCodeConfig">;

export interface TEnvironmentState {
  expiresAt: Date;
  data: {
    surveys: TEnvironmentStateSurvey[];
    actionClasses: TEnvironmentStateActionClass[];
    project: TEnvironmentStateProject;
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
  environmentId: string;
  appUrl: string;
  environment: TEnvironmentState;
  user: TUserState;
  filteredSurveys: TEnvironmentStateSurvey[];
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

export type TAttributes = Record<string, string>;

export interface TConfigInput {
  environmentId: string;
  appUrl: string;
}

export interface TStylingColor {
  light: string;
  dark?: string | null | undefined;
}

export interface TBaseStyling {
  brandColor?: TStylingColor | null;
  questionColor?: TStylingColor | null;
  inputColor?: TStylingColor | null;
  inputBorderColor?: TStylingColor | null;
  cardBackgroundColor?: TStylingColor | null;
  cardBorderColor?: TStylingColor | null;
  cardShadowColor?: TStylingColor | null;
  highlightBorderColor?: TStylingColor | null;
  isDarkModeEnabled?: boolean | null;
  roundness?: number | null;
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

export interface TProjectStyling extends TBaseStyling {
  allowStyleOverwrite: boolean;
}

export interface TSurveyStyling extends TBaseStyling {
  overwriteThemeStyling?: boolean | null;
}

export interface TWebViewOnMessageData {
  onFinished?: boolean | null;
  onDisplay?: boolean | null;
  onResponse?: boolean | null;
  responseUpdate?: TResponseUpdate | null;
  onRetry?: boolean | null;
  onClose?: boolean | null;
  onFileUpload?: boolean | null;
  fileUploadParams?: TFileUploadParams | null;
  uploadId?: string | null;
}

export const ZJsRNWebViewOnMessageData = z.object({
  onFinished: z.boolean().nullish(),
  onDisplayCreated: z.boolean().nullish(),
  onResponseCreated: z.boolean().nullish(),
  onClose: z.boolean().nullish(),
  onFilePick: z.boolean().nullish(),
  fileUploadParams: z
    .object({
      allowedFileExtensions: z.string().nullish(),
      allowMultipleFiles: z.boolean().nullish(),
    })
    .nullish(),
  onOpenExternalURL: z.boolean().nullish(),
  onOpenExternalURLParams: z
    .object({
      url: z.string(),
    })
    .nullish(),
});

export interface TUpdates {
  userId: string;
  attributes?: TAttributes;
}
