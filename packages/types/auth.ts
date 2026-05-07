import { ApiKeyPermission } from "@prisma/client";
import { z } from "zod";
import { ZOrganizationAccess } from "./api-key";
import { ZUser } from "./user";

export const ZAuthSession = z.object({
  user: ZUser,
});

export const ZAPIKeyWorkspacePermission = z.object({
  workspaceId: z.cuid2(),
  workspaceName: z.string(),
  permission: z.enum(ApiKeyPermission),
});

export type TAPIKeyWorkspacePermission = z.infer<typeof ZAPIKeyWorkspacePermission>;

export const ZAuthenticationApiKey = z.object({
  type: z.literal("apiKey"),
  workspacePermissions: z.array(ZAPIKeyWorkspacePermission),
  apiKeyId: z.string(),
  organizationId: z.string(),
  organizationAccess: ZOrganizationAccess,
});

export type TAuthSession = z.infer<typeof ZAuthSession>;
export type TAuthenticationApiKey = z.infer<typeof ZAuthenticationApiKey>;
