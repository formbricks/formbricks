import { z } from "zod";
import { ZLegacySurveyQuestions, ZLegacySurveyThankYouCard, ZLegacySurveyWelcomeCard } from "./LegacySurvey";
import { ZSurveyHiddenFields, ZSurveyQuestions, ZSurveyThankYouCard, ZSurveyWelcomeCard } from "./surveys";
import { ZUserObjective } from "./user";

export const ZTemplateChannel = z.enum(["Website Survey", "App Survey", "Email Survey", "Link Survey"]);
export type TTemplateChannel = z.infer<typeof ZTemplateChannel>;

export const ZTemplateIndustry = z.enum([
  "E-Commerce",
  "SaaS",
  "Healthcare",
  "Education",
  "Government",
  "Other",
]);
export type TTemplateIndustry = z.infer<typeof ZTemplateIndustry>;

export const ZTemplateRole = z.enum(["Product Manager", "Customer Success", "Marketing", "Sales", "Other"]);
export type TTemplateRole = z.infer<typeof ZTemplateRole>;

export const ZTemplate = z.object({
  name: z.string(),
  description: z.string(),
  icon: z.any().optional(),
  role: ZTemplateRole.optional(),
  channels: z.array(ZTemplateChannel).optional(),
  industries: z.array(ZTemplateIndustry).optional(),
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
