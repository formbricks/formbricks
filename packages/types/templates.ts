import { z } from "zod";
import { ZSurveyWelcomeCard, ZSurveyHiddenFields, ZSurveyQuestions, ZSurveyThankYouCard } from "./surveys";
import { ZProfileObjective } from "./profile";

export const ZTemplate = z.object({
  name: z.string(),
  description: z.string(),
  icon: z.any().optional(),
  category: z
    .enum(["Product Experience", "Exploration", "Growth", "Increase Revenue", "Customer Success"])
    .optional(),
  objectives: z.array(ZProfileObjective).optional(),
  preset: z.object({
    name: z.string(),
    welcomeCard: ZSurveyWelcomeCard,
    questions: ZSurveyQuestions,
    thankYouCard: ZSurveyThankYouCard,
    hiddenFields: ZSurveyHiddenFields,
  }),
});

export type TTemplate = z.infer<typeof ZTemplate>;
