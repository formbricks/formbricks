import { type ApiKey, type ApiKeyEnvironment, ApiKeyPermission, EnvironmentType } from "@prisma/client";
import { z } from "zod";
import { ZOrganizationAccess } from "../../types/api-key";

export const ZApiKeyPermission = z.enum(ApiKeyPermission);

export const ZApiKeyEnvironment = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  apiKeyId: z.cuid2(),
  environmentId: z.cuid2(),
  projectId: z.cuid2(),
  projectName: z.string(),
  environmentType: z.enum(EnvironmentType),
  permission: ZApiKeyPermission,
}) satisfies z.ZodType<ApiKeyEnvironment>;

export const ZApiKey = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  createdBy: z.string(),
  lastUsedAt: z.date().nullable(),
  label: z.string(),
  hashedKey: z.string(),
  lookupHash: z.string().nullable(),
  organizationId: z.cuid2(),
  organizationAccess: ZOrganizationAccess,
}) satisfies z.ZodType<ApiKey>;

export const ZApiKeyCreateInput = z.object({
  label: z.string(),
  organizationId: z.cuid2(),
  environmentIds: z.array(z.cuid2()),
  permissions: z.record(z.cuid2(), ZApiKeyPermission),
  createdBy: z.string(),
});

export const ZApiKeyEnvironmentCreateInput = z.object({
  apiKeyId: z.cuid2(),
  environmentId: z.cuid2(),
  permission: ZApiKeyPermission,
});

export const ZApiKeyData = ZApiKey.pick({
  organizationId: true,
  organizationAccess: true,
}).extend(
  z.object({
    environments: z.array(
      ZApiKeyEnvironment.pick({
        environmentId: true,
        environmentType: true,
        permission: true,
        projectId: true,
        projectName: true,
      })
    ),
  }).shape
);
