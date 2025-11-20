import { z } from "zod";
import { ZSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { ZActionClassNoCodeConfig, ZActionClassType } from "@formbricks/types/action-classes";
import { type TSurvey } from "@formbricks/types/surveys/types";

// Schema for exported action class (subset of full action class)
export const ZExportedActionClass = z.object({
  name: z.string(),
  description: z.string().nullable(),
  type: ZActionClassType,
  key: z.string().nullable(),
  noCodeConfig: ZActionClassNoCodeConfig.nullable(),
});

export type TExportedActionClass = z.infer<typeof ZExportedActionClass>;

// Schema for exported trigger
export const ZExportedTrigger = z.object({
  actionClass: ZExportedActionClass,
});

export type TExportedTrigger = z.infer<typeof ZExportedTrigger>;

// Schema for exported language
export const ZExportedLanguage = z.object({
  code: z.string(),
  enabled: z.boolean(),
  default: z.boolean(),
});

export type TExportedLanguage = z.infer<typeof ZExportedLanguage>;

// Full export payload schema - based on ZSurveyCreateInput input type with custom trigger/language format
export const ZSurveyExportPayload = z.object({
  // Use the input shape from ZSurveyCreateInput and override what we need
  name: z.string(),
  type: z.string().optional(),
  status: z.string().optional(),
  displayOption: z.string().optional(),
  environmentId: z.string().optional(),
  createdBy: z.string().optional(),
  autoClose: z.number().nullable().optional(),
  recontactDays: z.number().nullable().optional(),
  displayLimit: z.number().nullable().optional(),
  delay: z.number().optional(),
  displayPercentage: z.number().nullable().optional(),
  autoComplete: z.number().nullable().optional(),
  isVerifyEmailEnabled: z.boolean().optional(),
  isSingleResponsePerEmailEnabled: z.boolean().optional(),
  isBackButtonHidden: z.boolean().optional(),
  pin: z.string().nullable().optional(),
  welcomeCard: z.any().optional(),
  questions: z.array(z.any()),
  endings: z.array(z.any()).optional(),
  hiddenFields: z.any().optional(),
  variables: z.array(z.any()).optional(),
  surveyClosedMessage: z.any().optional(),
  styling: z.any().optional(),
  showLanguageSwitch: z.boolean().nullable().optional(),
  recaptcha: z.any().optional(),
  metadata: z.any().optional(),
  triggers: z.array(ZExportedTrigger).default([]),
  languages: z.array(ZExportedLanguage).default([]),
  followUps: z.array(ZSurveyFollowUp.omit({ createdAt: true, updatedAt: true })).default([]),
});

export type TSurveyExportPayload = z.infer<typeof ZSurveyExportPayload>;

export const transformSurveyForExport = (survey: TSurvey): TSurveyExportPayload => {
  const exportData: TSurveyExportPayload = {
    name: survey.name,
    type: survey.type,
    status: survey.status,
    displayOption: survey.displayOption,
    autoClose: survey.autoClose,
    recontactDays: survey.recontactDays,
    displayLimit: survey.displayLimit,
    delay: survey.delay,
    displayPercentage: survey.displayPercentage,
    autoComplete: survey.autoComplete,
    isVerifyEmailEnabled: survey.isVerifyEmailEnabled,
    isSingleResponsePerEmailEnabled: survey.isSingleResponsePerEmailEnabled,
    isBackButtonHidden: survey.isBackButtonHidden,
    pin: survey.pin,
    welcomeCard: survey.welcomeCard,
    questions: survey.questions,
    endings: survey.endings,
    hiddenFields: survey.hiddenFields,
    variables: survey.variables,
    surveyClosedMessage: survey.surveyClosedMessage,
    styling: survey.styling,
    showLanguageSwitch: survey.showLanguageSwitch,
    recaptcha: survey.recaptcha,
    metadata: survey.metadata,

    triggers:
      survey.triggers?.map(
        (t): TExportedTrigger => ({
          actionClass: {
            name: t.actionClass.name,
            description: t.actionClass.description,
            type: t.actionClass.type,
            key: t.actionClass.key,
            noCodeConfig: t.actionClass.noCodeConfig,
          },
        })
      ) ?? [],

    languages:
      survey.languages?.map(
        (l): TExportedLanguage => ({
          enabled: l.enabled,
          default: l.default,
          code: l.language.code,
        })
      ) ?? [],

    followUps:
      survey.followUps?.map((f) => ({
        id: f.id,
        surveyId: f.surveyId,
        name: f.name,
        trigger: f.trigger,
        action: f.action,
      })) ?? [],
  };

  return exportData;
};
