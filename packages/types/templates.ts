import { z } from "zod";
import { ZLegacySurveyQuestions, ZLegacySurveyThankYouCard, ZLegacySurveyWelcomeCard } from "./LegacySurvey";
import { ZProductIndustry } from "./product";
import {
  ZSurveyHiddenFields,
  ZSurveyQuestions,
  ZSurveyThankYouCard,
  ZSurveyType,
  ZSurveyWelcomeCard,
} from "./surveys";
import { ZUserObjective } from "./user";

export const ZTemplateRole = z.enum(["productManager", "customerSuccess", "marketing", "sales", "other"]);
export type TTemplateRole = z.infer<typeof ZTemplateRole>;

export const ZTemplate = z.object({
  name: z.string(),
  description: z.string(),
  icon: z.any().optional(),
  role: ZTemplateRole.optional(),
  channels: z.array(ZSurveyType).optional(),
  industries: z.array(ZProductIndustry).optional(),
  objectives: z.array(ZUserObjective).optional(),
  preset: z.object({
    name: z.string(),
    welcomeCard: ZSurveyWelcomeCard,
    questions: ZSurveyQuestions,
    thankYouCard: ZSurveyThankYouCard,
    hiddenFields: ZSurveyHiddenFields,
  }),
});

export type TTemplate = z.infer<typeof ZTemplate>;

export const ZLegacyTemplate = ZTemplate.extend({
  preset: z.object({
    name: z.string(),
    welcomeCard: ZLegacySurveyWelcomeCard,
    questions: ZLegacySurveyQuestions,
    thankYouCard: ZLegacySurveyThankYouCard,
    hiddenFields: ZSurveyHiddenFields,
  }),
});

export type TLegacyTemplate = z.infer<typeof ZLegacyTemplate>;
