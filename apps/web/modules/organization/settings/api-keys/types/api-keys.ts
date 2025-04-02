import { ApiKey, ApiKeyPermission } from "@prisma/client";
import { z } from "zod";
import { ZApiKey } from "@formbricks/database/zod/api-keys";
import { ZOrganizationAccess } from "@formbricks/types/api-key";
import { ZEnvironment } from "@formbricks/types/environment";

export const ZApiKeyEnvironmentPermission = z.object({
  environmentId: z.string(),
  permission: z.nativeEnum(ApiKeyPermission),
});

export const ZApiKeyCreateInput = ZApiKey.required({
  label: true,
})
  .pick({
    label: true,
  })
  .extend({
    environmentPermissions: z.array(ZApiKeyEnvironmentPermission).optional(),
    organizationAccess: ZOrganizationAccess,
  });

export type TApiKeyCreateInput = z.infer<typeof ZApiKeyCreateInput>;

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
  permission: z.nativeEnum(ApiKeyPermission),
});

export type TApiKeyEnvironmentPermission = z.infer<typeof TApiKeyEnvironmentPermission>;

export interface TApiKeyWithEnvironmentPermission
  extends Pick<ApiKey, "id" | "label" | "createdAt" | "organizationAccess"> {
  apiKeyEnvironments: TApiKeyEnvironmentPermission[];
}
