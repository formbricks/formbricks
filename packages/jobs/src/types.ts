import { z } from "zod";
import { ZResponse } from "@formbricks/types/responses";
import { ZTag } from "@formbricks/types/tags";

export const ZTestLogJobData = z.object({
  message: z.string().min(1),
  shouldFail: z.boolean().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type TTestLogJobData = z.infer<typeof ZTestLogJobData>;

export const ZResponsePipelineEvent = z.enum(["responseFinished", "responseCreated", "responseUpdated"]);

export type TResponsePipelineEvent = z.infer<typeof ZResponsePipelineEvent>;

const ZResponsePipelineJobTag = ZTag.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const ZResponsePipelineJobResponse = ZResponse.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  tags: z.array(ZResponsePipelineJobTag),
});

export const ZResponsePipelineJobData = z.object({
  event: ZResponsePipelineEvent,
  response: ZResponsePipelineJobResponse,
  environmentId: z.string().min(1),
  surveyId: z.string().min(1),
});

export type TResponsePipelineJobData = z.infer<typeof ZResponsePipelineJobData>;

export const ZAITranslationField = z.object({
  path: z.string(),
  defaultText: z.string(),
  isRichText: z.boolean(),
});

export const ZAITranslationJobData = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  fields: z.array(ZAITranslationField).min(1),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
});

export type TAITranslationJobData = z.infer<typeof ZAITranslationJobData>;
