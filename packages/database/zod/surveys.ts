/* eslint-disable import/no-relative-packages -- Need to import from parent package */
import { SurveyStatus, SurveyType } from "@prisma/client";
import { z } from "zod";
import { ZOverlay } from "../../types/common";
// eslint-disable-next-line import/no-relative-packages -- Need to import from parent package
import { ZLogo } from "../../types/styling";
import { ZSurveyBlocks } from "../../types/surveys/blocks";
import {
  ZSurveyEnding,
  ZSurveyMetadata,
  ZSurveyQuestion,
  ZSurveyRecaptcha,
  ZSurveyVariable,
} from "../../types/surveys/types";

const ZColor = z.string().regex(/^#(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);

export const ZStylingColor = z.object({
  light: ZColor,
  dark: ZColor.nullish(),
});

export const ZCardArrangementOptions = z.enum(["casual", "straight", "simple"]);

export const ZCardArrangement = z.object({
  linkSurveys: ZCardArrangementOptions,
  appSurveys: ZCardArrangementOptions,
});

export const ZSurveyStylingBackground = z.object({
  bg: z.string().nullish(),
  bgType: z.enum(["animation", "color", "image", "upload"]).nullish(),
  brightness: z.number().nullish(),
});

export const ZPlacement = z.enum(["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]);

const ZSurveyBase = z.object({
  id: z.cuid2().describe("The ID of the survey"),
  createdAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the survey was created"),
  updatedAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the survey was last updated"),
  name: z.string().describe("The name of the survey"),
  redirectUrl: z.url().nullable().describe("The URL to redirect to after the survey is completed"),
  type: z.enum(SurveyType).describe("The type of the survey"),
  status: z.enum(SurveyStatus).describe("The status of the survey"),
  thankYouMessage: z.string().nullable().describe("The thank you message of the survey"),
  showLanguageSwitch: z.boolean().nullable().describe("Whether to show the language switch"),
  showThankYouMessage: z.boolean().nullable().describe("Whether to show the thank you message"),
  welcomeCard: z
    .object({
      enabled: z.boolean(),
      timeToFinish: z.boolean(),
      showResponseCount: z.boolean(),
      headline: z.record(z.string(), z.string()).optional(),
      subheader: z.record(z.string(), z.string()).optional(),
      fileUrl: z.string().optional(),
      buttonLabel: z.record(z.string(), z.string()).optional(),
      videoUrl: z.string().optional(),
    })
    .describe("The welcome card configuration"),
  displayProgressBar: z.boolean().nullable().describe("Whether to display the progress bar"),
  pin: z.string().nullable().describe("The pin of the survey"),
  createdBy: z.string().nullable().describe("The user who created the survey"),
  environmentId: z.cuid2().describe("The environment ID of the survey"),
  questions: z.array(ZSurveyQuestion).describe("The questions of the survey"),
  blocks: ZSurveyBlocks.prefault([]).describe("The blocks of the survey"),
  endings: z.array(ZSurveyEnding).prefault([]).describe("The endings of the survey"),
  hiddenFields: z
    .object({
      enabled: z.boolean(),
      fieldIds: z.array(z.string()).optional(),
    })
    .describe("Hidden fields configuration"),
  variables: z.array(ZSurveyVariable).describe("Survey variables"),
  displayOption: z
    .enum(["displayOnce", "displayMultiple", "displaySome", "respondMultiple"])
    .describe("Display options for the survey"),
  recontactDays: z.number().nullable().describe("Days before recontacting"),
  displayLimit: z.number().nullable().describe("Display limit for the survey"),
  autoClose: z.number().nullable().describe("Auto close time in seconds"),
  autoComplete: z.number().nullable().describe("Auto complete time in seconds"),
  delay: z.number().describe("Delay before showing survey"),
  surveyClosedMessage: z
    .object({
      enabled: z.boolean(),
      heading: z.string(),
      subheading: z.string(),
    })
    .nullable()
    .describe("Message shown when survey is closed"),
  segmentId: z.string().nullable().describe("ID of the segment"),
  projectOverwrites: z
    .object({
      brandColor: ZColor.nullish(),
      highlightBorderColor: ZColor.nullish(),
      placement: ZPlacement.nullish(),
      clickOutsideClose: z.boolean().nullish(),
      overlay: ZOverlay.nullish(),
    })
    .nullable()
    .describe("Project specific overwrites"),
  styling: z
    .object({
      brandColor: ZStylingColor.nullish(),
      questionColor: ZStylingColor.nullish(),
      inputColor: ZStylingColor.nullish(),
      inputBorderColor: ZStylingColor.nullish(),
      cardBackgroundColor: ZStylingColor.nullish(),
      cardBorderColor: ZStylingColor.nullish(),
      highlightBorderColor: ZStylingColor.nullish(),
      isDarkModeEnabled: z.boolean().nullish(),
      roundness: z.number().nullish(),
      cardArrangement: ZCardArrangement.nullish(),
      background: ZSurveyStylingBackground.nullish(),
      hideProgressBar: z.boolean().nullish(),
      isLogoHidden: z.boolean().nullish(),
      logo: ZLogo.nullish(),
    })
    .nullable()
    .describe("Survey styling configuration"),
  singleUse: z
    .object({
      enabled: z.boolean(),
      isEncrypted: z.boolean(),
    })
    .describe("Single use configuration"),
  isVerifyEmailEnabled: z.boolean().describe("Whether email verification is enabled"),
  isSingleResponsePerEmailEnabled: z.boolean().describe("Whether single response per email is enabled"),
  inlineTriggers: z.array(z.any()).nullable().describe("Inline triggers configuration"),
  isBackButtonHidden: z.boolean().describe("Whether the back button is hidden"),
  recaptcha: ZSurveyRecaptcha.describe("Google reCAPTCHA configuration"),
  metadata: ZSurveyMetadata.describe("Custom link metadata for social sharing"),
  displayPercentage: z.number().nullable().describe("The display percentage of the survey"),
});

export const ZSurvey = ZSurveyBase;

export const ZSurveyWithoutQuestionType = ZSurveyBase.omit({
  questions: true,
}).extend({
  questions: z.array(z.any()).describe("The questions of the survey."),
});

ZSurvey.meta({
  id: "survey",
}).describe("A survey");
