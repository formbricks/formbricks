import { type ApiKey, ApiKeyPermission } from "@prisma/client";
import { z } from "zod";
import { ZOrganizationAccess } from "@formbricks/types/api-key";
import { ZWorkspace } from "@formbricks/types/workspace";

export const ZApiKeyWorkspacePermission = z.object({
  workspaceId: z.string(),
  permission: z.enum(ApiKeyPermission),
});

export const ZApiKeyCreateInput = z
  .object({
    label: z.string(),
    workspacePermissions: z.array(ZApiKeyWorkspacePermission).optional(),
    organizationAccess: ZOrganizationAccess,
  })
  .refine(
    (data) => {
      if (!data.workspacePermissions) return true;
      const ids = data.workspacePermissions.map((p) => p.workspaceId);
      return new Set(ids).size === ids.length;
    },
    { message: "Duplicate workspace permissions are not allowed", path: ["workspacePermissions"] }
  );

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
});

export type TOrganizationWorkspace = z.infer<typeof OrganizationWorkspace>;

export type TApiKeyWorkspacePermission = z.infer<typeof ZApiKeyWorkspacePermission>;

export interface TApiKeyWithEnvironmentPermission extends Pick<
  ApiKey,
  "id" | "label" | "createdAt" | "organizationAccess"
> {
  apiKeyWorkspaces: TApiKeyWorkspacePermission[];
}

const ZApiKeyWorkspaceWithWorkspace = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  apiKeyId: z.string(),
  workspaceId: z.string(),
  permission: z.enum(ApiKeyPermission),
  workspace: ZWorkspace.pick({ id: true, name: true }),
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
  apiKeyWorkspaces: z.array(ZApiKeyWorkspaceWithWorkspace),
});

export type TApiKeyWithEnvironmentAndWorkspace = z.infer<typeof ZApiKeyWithEnvironmentAndWorkspace>;
