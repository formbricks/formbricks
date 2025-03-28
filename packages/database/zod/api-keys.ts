import { type ApiKey, type ApiKeyEnvironment, ApiKeyPermission } from "@prisma/client";
import { z } from "zod";

export const ZApiKeyPermission = z.nativeEnum(ApiKeyPermission);

export const ZApiKeyEnvironment = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  apiKeyId: z.string().cuid2(),
  environmentId: z.string().cuid2(),
  permission: ZApiKeyPermission,
}) satisfies z.ZodType<ApiKeyEnvironment>;

export const ZApiKey = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  createdBy: z.string(),
  lastUsedAt: z.date().nullable(),
  label: z.string(),
  hashedKey: z.string(),
  organizationId: z.string().cuid2(),
}) satisfies z.ZodType<ApiKey>;

export const ZApiKeyCreateInput = z.object({
  label: z.string(),
  organizationId: z.string().cuid2(),
  environmentIds: z.array(z.string().cuid2()),
  permissions: z.record(z.string().cuid2(), ZApiKeyPermission),
  createdBy: z.string(),
});

export const ZApiKeyEnvironmentCreateInput = z.object({
  apiKeyId: z.string().cuid2(),
  environmentId: z.string().cuid2(),
  permission: ZApiKeyPermission,
});
