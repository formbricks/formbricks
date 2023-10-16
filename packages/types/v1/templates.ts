import { z } from "zod";
import { ZSurveyHiddenFields, ZSurveyQuestions, ZSurveyThankYouCard } from "./surveys";

const ZTemplateObjective = z.enum([
  "increase_user_adoption",
  "increase_conversion",
  "support_sales",
  "sharpen_marketing_messaging",
  "improve_user_retention",
  "other",
]);

export const ZTemplate = z.object({
  name: z.string(),
  description: z.string(),
  icon: z.any().optional(),
  category: z
    .enum(["Product Experience", "Exploration", "Growth", "Increase Revenue", "Customer Success"])
    .optional(),
  objectives: z.array(ZTemplateObjective).optional(),
  preset: z.object({
    name: z.string(),
    questions: ZSurveyQuestions,
    thankYouCard: ZSurveyThankYouCard,
    hiddenFields: ZSurveyHiddenFields,
  }),
});

export type TTemplate = z.infer<typeof ZTemplate>;
