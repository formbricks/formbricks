import { ApiKeyPermission } from "@prisma/client";
import { z } from "zod";
import { ZOrganizationAccess } from "./api-key";
import { ZUser } from "./user";

export const ZAuthSession = z.object({
  user: ZUser,
});

export const ZAPIKeyEnvironmentPermission = z.object({
  environmentId: z.string(),
  permission: z.nativeEnum(ApiKeyPermission),
});

export type TAPIKeyEnvironmentPermission = z.infer<typeof ZAPIKeyEnvironmentPermission>;

export const ZAuthenticationApiKey = z.object({
  type: z.literal("apiKey"),
  environmentPermissions: z.array(ZAPIKeyEnvironmentPermission),
  hashedApiKey: z.string(),
  apiKeyId: z.string().optional(),
  organizationId: z.string().optional(),
  organizationAccess: ZOrganizationAccess,
});

export type TAuthSession = z.infer<typeof ZAuthSession>;
export type TAuthenticationApiKey = z.infer<typeof ZAuthenticationApiKey>;
