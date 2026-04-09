import { ApiKeyPermission, EnvironmentType } from "@prisma/client";
import { z } from "zod";
import { ZOrganizationAccess } from "./api-key";
import { ZUser } from "./user";

export const ZAuthSession = z.object({
  user: ZUser,
});

export const ZAPIKeyEnvironmentPermission = z.object({
  environmentId: z.string(),
  environmentType: z.enum(EnvironmentType),
  projectId: z.cuid2(),
  projectName: z.string(),
  permission: z.enum(ApiKeyPermission),
});

export type TAPIKeyEnvironmentPermission = z.infer<typeof ZAPIKeyEnvironmentPermission>;

export const ZAuthenticationApiKey = z.object({
  type: z.literal("apiKey"),
  environmentPermissions: z.array(ZAPIKeyEnvironmentPermission),
  apiKeyId: z.string(),
  organizationId: z.string(),
  organizationAccess: ZOrganizationAccess,
});

export type TAuthSession = z.infer<typeof ZAuthSession>;
export type TAuthenticationApiKey = z.infer<typeof ZAuthenticationApiKey>;
