import { z } from "zod";
import { ZIntegrationBase, ZIntegrationBaseSurveyData } from "./shared-types";

export const ZIntegrationPlainCredential = z.string().min(1);

export type TIntegrationPlainCredential = z.infer<typeof ZIntegrationPlainCredential>;

// Define Plain field types
export const ZPlainFieldType = z.enum([
  "componentText",
  "title",
  "customerIdentifier",
  "threadField",
  "labelTypeId",
  "assignedTo",
  "tenantId",
]);

export type TPlainFieldType = z.infer<typeof ZPlainFieldType>;

// Define Plain mapping type
export const ZPlainMapping = z.object({
  question: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
  }),
  plainField: z.object({
    id: z.string(),
    name: z.string(),
    type: ZPlainFieldType,
    config: z.record(z.any()).optional(),
  }),
});

export type TPlainMapping = z.infer<typeof ZPlainMapping>;

export const ZIntegrationPlainConfigData = z
  .object({
    // question -> plain thread mapping
    mapping: z.array(ZPlainMapping),
    customerIdentifierField: z.enum(["emailAddress", "externalId", "customerId"]).default("emailAddress"),
    includeCreatedAt: z.boolean().default(true),
    includeComponents: z.boolean().default(true),
    titleTemplate: z.string().optional(),
  })
  .merge(
    ZIntegrationBaseSurveyData.omit({
      questionIds: true,
      questions: true,
    })
  );

export type TIntegrationPlainConfigData = z.infer<typeof ZIntegrationPlainConfigData>;

export const ZIntegrationPlainConfig = z.object({
  key: ZIntegrationPlainCredential,
  data: z.array(ZIntegrationPlainConfigData),
});

export type TIntegrationPlainConfig = z.infer<typeof ZIntegrationPlainConfig>;

export const ZIntegrationPlain = ZIntegrationBase.extend({
  type: z.literal("plain"),
  config: ZIntegrationPlainConfig,
});

export type TIntegrationPlain = z.infer<typeof ZIntegrationPlain>;

export const ZIntegrationPlainInput = z.object({
  type: z.literal("plain"),
  config: ZIntegrationPlainConfig,
});

export type TIntegrationPlainInput = z.infer<typeof ZIntegrationPlainInput>;

export const ZIntegrationPlainDatabase = z.object({
  id: z.string(),
  name: z.string(),
  properties: z.object({}),
});

export type TIntegrationPlainDatabase = z.infer<typeof ZIntegrationPlainDatabase>;
