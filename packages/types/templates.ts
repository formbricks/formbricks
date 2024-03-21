import { z } from "zod";

import { ZLegacySurveyQuestions, ZLegacySurveyThankYouCard, ZLegacySurveyWelcomeCard } from "./LegacySurvey";
import { ZSurveyHiddenFields, ZSurveyQuestions, ZSurveyThankYouCard, ZSurveyWelcomeCard } from "./surveys";
import { ZUserObjective } from "./user";

export const ZTemplate = z.object({
  name: z.string(),
  description: z.string(),
  icon: z.any().optional(),
  category: z
    .enum(["Product Experience", "Exploration", "Growth", "Increase Revenue", "Customer Success"])
    .optional(),
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
