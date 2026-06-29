import { z } from "zod";
import { ZOrganizationAccess } from "./api-key";
import { ZUser } from "./user";

export const ZApiKeyPermission = z.enum(["read", "write", "manage"]);
export type TApiKeyPermission = z.infer<typeof ZApiKeyPermission>;

export const ZAuthSession = z.object({
  user: ZUser,
});

export const ZAPIKeyWorkspacePermission = z.object({
  workspaceId: z.cuid2(),
  workspaceName: z.string(),
  permission: ZApiKeyPermission,
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

/**
 * Application session shape — formerly the `next-auth` `Session` module augmentation
 * (packages/types/next-auth.d.ts), removed in the ENG-1054 Better Auth migration. The session DAL
 * (apps/web/modules/auth/lib/session.ts) maps Better Auth's session onto this shape, and consumers
 * read it. Structurally identical to the old augmented type, so it is a drop-in replacement.
 */
export interface Session {
  user: {
    id: string;
    isActive?: boolean;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  expires: string;
}

/**
 * OAuth account shape for the SSO account-linking flow — formerly `next-auth`'s `Account`. Mirrors the
 * provider/token fields the linking code reads (apps/web/modules/ee/sso/lib/account-linking.ts).
 */
export interface Account {
  provider: string;
  type: string | null; // Better Auth-created accounts set no `type` (column nullable, ENG-1054 cutover)
  providerAccountId: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}
