import { type ApiKey, ApiKeyPermission } from "@prisma/client";
import { z } from "zod";
import { ZOrganizationAccess } from "@formbricks/types/api-key";
import { ZEnvironment } from "@formbricks/types/environment";
import { ZProject } from "@formbricks/types/project";

export const ZApiKeyEnvironmentPermission = z.object({
  environmentId: z.string(),
  permission: z.enum(ApiKeyPermission),
});

export const ZApiKeyCreateInput = z.object({
  label: z.string(),
  environmentPermissions: z.array(ZApiKeyEnvironmentPermission).optional(),
  organizationAccess: ZOrganizationAccess,
});

export type TApiKeyCreateInput = z.infer<typeof ZApiKeyCreateInput>;

export const ZApiKeyUpdateInput = z.object({
  label: z.string(),
});

export type TApiKeyUpdateInput = z.infer<typeof ZApiKeyUpdateInput>;

export interface TApiKey extends ApiKey {
  apiKey?: string;
}

export const OrganizationProject = z.object({
  id: z.string(),
  name: z.string(),
  environments: z.array(ZEnvironment),
});

export type TOrganizationProject = z.infer<typeof OrganizationProject>;

export const TApiKeyEnvironmentPermission = z.object({
  environmentId: z.string(),
  permission: z.enum(ApiKeyPermission),
});

export type TApiKeyEnvironmentPermission = z.infer<typeof TApiKeyEnvironmentPermission>;

export interface TApiKeyWithEnvironmentPermission extends Pick<
  ApiKey,
  "id" | "label" | "createdAt" | "organizationAccess"
> {
  apiKeyEnvironments: TApiKeyEnvironmentPermission[];
}

const ZApiKeyEnvironmentWithProject = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  apiKeyId: z.string(),
  environmentId: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  environmentType: z.string(),
  permission: z.enum(ApiKeyPermission),
  environment: ZEnvironment.extend({
    project: ZProject.pick({ id: true, name: true }),
  }),
});

const ZApiKey = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  lastUsedAt: z.date().nullable(),
  label: z.string(),
  hashedKey: z.string(),
  lookupHash: z.string().nullable(),
  organizationId: z.string(),
  organizationAccess: ZOrganizationAccess,
});

export const ZApiKeyWithEnvironmentAndProject = ZApiKey.extend({
  apiKeyEnvironments: z.array(ZApiKeyEnvironmentWithProject),
});

export type TApiKeyWithEnvironmentAndProject = z.infer<typeof ZApiKeyWithEnvironmentAndProject>;
