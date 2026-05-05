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

export const ZAPIKeyFeedbackDirectoryPermission = z.object({
  feedbackDirectoryId: z.cuid2(),
  feedbackDirectoryName: z.string(),
  permission: z.enum(ApiKeyPermission),
});

export type TAPIKeyFeedbackDirectoryPermission = z.infer<typeof ZAPIKeyFeedbackDirectoryPermission>;

export const ZAuthenticationApiKey = z.object({
  type: z.literal("apiKey"),
  workspacePermissions: z.array(ZAPIKeyWorkspacePermission),
  feedbackDirectoryPermissions: z.array(ZAPIKeyFeedbackDirectoryPermission),
  apiKeyId: z.string(),
  organizationId: z.string(),
  organizationAccess: ZOrganizationAccess,
});

export type TAuthSession = z.infer<typeof ZAuthSession>;
export type TAuthenticationApiKey = z.infer<typeof ZAuthenticationApiKey>;
