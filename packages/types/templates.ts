import { z } from "zod";
import { ZProjectConfigChannel, ZProjectConfigIndustry } from "./project";
import { ZSurveyBlocks } from "./surveys/blocks";
import { ZSurveyEndings, ZSurveyHiddenFields, ZSurveyStyling, ZSurveyWelcomeCard } from "./surveys/types";

export const ZTemplateRole = z.enum([
  "productManager",
  "customerSuccess",
  "marketing",
  "sales",
  "peopleManager",
]);
export type TTemplateRole = z.infer<typeof ZTemplateRole>;

export const ZTemplate = z.object({
  name: z.string(),
  description: z.string(),
  icon: z.any().optional(),
  role: ZTemplateRole.optional(),
  channels: z.array(z.enum(["link", "app", "website"])).optional(),
  industries: z.array(z.enum(["eCommerce", "saas", "other"])).optional(),
  preset: z.object({
    name: z.string(),
    welcomeCard: ZSurveyWelcomeCard,
    blocks: ZSurveyBlocks.default([]),
    endings: ZSurveyEndings,
    hiddenFields: ZSurveyHiddenFields,
  }),
});

export type TTemplate = z.infer<typeof ZTemplate>;

export const ZXMTemplate = z.object({
  name: z.string(),
  blocks: ZSurveyBlocks,
  endings: ZSurveyEndings,
  styling: ZSurveyStyling,
});

export type TXMTemplate = z.infer<typeof ZXMTemplate>;

export const ZTemplateFilter = z.union([
  ZProjectConfigChannel,
  ZProjectConfigIndustry,
  ZTemplateRole,
  z.null(),
]);

export type TTemplateFilter = z.infer<typeof ZTemplateFilter>;
