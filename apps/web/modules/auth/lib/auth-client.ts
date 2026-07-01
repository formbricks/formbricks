import { genericOAuthClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client (ENG-1054). Same-origin, so no baseURL is needed. This is the ONLY
 * auth module a `"use client"` component should import. Client plugins must mirror the server
 * plugins in auth.ts (genericOAuth providers are added in Phase 5).
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient(), genericOAuthClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
