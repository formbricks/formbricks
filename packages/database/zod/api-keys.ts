import { type ApiKey, ApiKeyPermission, type ApiKeyWorkspace } from "@prisma/client";
import { z } from "zod";
import { ZOrganizationAccess } from "../../types/api-key";

export const ZApiKeyPermission = z.enum(ApiKeyPermission);

export const ZApiKeyWorkspace = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  apiKeyId: z.cuid2(),
  workspaceId: z.cuid2(),
  permission: ZApiKeyPermission,
}) satisfies z.ZodType<ApiKeyWorkspace>;

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
  workspaceIds: z.array(z.cuid2()),
  permissions: z.record(z.cuid2(), ZApiKeyPermission),
  createdBy: z.string(),
});

export const ZApiKeyWorkspaceCreateInput = z.object({
  apiKeyId: z.cuid2(),
  workspaceId: z.cuid2(),
  permission: ZApiKeyPermission,
});

export const ZApiKeyData = ZApiKey.pick({
  organizationId: true,
  organizationAccess: true,
}).extend(
  z.object({
    workspaces: z.array(
      ZApiKeyWorkspace.pick({
        permission: true,
        workspaceId: true,
      })
    ),
  }).shape
);
