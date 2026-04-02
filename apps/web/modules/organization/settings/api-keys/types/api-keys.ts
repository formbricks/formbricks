import { type ApiKey, ApiKeyPermission } from "@prisma/client";
import { z } from "zod";
import { ZOrganizationAccess } from "@formbricks/types/api-key";
import { ZEnvironment } from "@formbricks/types/environment";
import { ZWorkspace } from "@formbricks/types/workspace";

export const ZApiKeyEnvironmentPermission = z.object({
  environmentId: z.string(),
  workspaceId: z.string(),
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

export const OrganizationWorkspace = z.object({
  id: z.string(),
  name: z.string(),
  environments: z.array(ZEnvironment),
});

export type TOrganizationWorkspace = z.infer<typeof OrganizationWorkspace>;

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

const ZApiKeyEnvironmentWithWorkspace = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  apiKeyId: z.string(),
  environmentId: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  environmentType: z.string(),
  permission: z.enum(ApiKeyPermission),
  environment: ZEnvironment.extend({
    workspace: ZWorkspace.pick({ id: true, name: true }),
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

export const ZApiKeyWithEnvironmentAndWorkspace = ZApiKey.extend({
  apiKeyEnvironments: z.array(ZApiKeyEnvironmentWithWorkspace),
});

export type TApiKeyWithEnvironmentAndWorkspace = z.infer<typeof ZApiKeyWithEnvironmentAndWorkspace>;
