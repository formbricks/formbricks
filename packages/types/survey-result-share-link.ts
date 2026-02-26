import { z } from "zod";
import { ZId } from "./common";

export const ZSurveyResultShareLinkExpiresIn = z.enum(["7d", "30d", "90d", "never"]);
export type TSurveyResultShareLinkExpiresIn = z.infer<typeof ZSurveyResultShareLinkExpiresIn>;

export const ZCreateSurveyResultShareLink = z.object({
  surveyId: ZId,
  expiresIn: ZSurveyResultShareLinkExpiresIn.optional().default("never"),
  label: z.string().max(100).optional(),
});
export type TCreateSurveyResultShareLink = z.infer<typeof ZCreateSurveyResultShareLink>;

export const ZSurveyResultShareLink = z.object({
  id: z.string().cuid(),
  surveyId: ZId,
  token: z.string(),
  label: z.string().nullable(),
  expiresAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
  createdById: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TSurveyResultShareLink = z.infer<typeof ZSurveyResultShareLink>;
