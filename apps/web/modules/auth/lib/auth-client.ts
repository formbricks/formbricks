import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client (ENG-1054). Same-origin, so no baseURL is needed. This is the ONLY
 * auth module a `"use client"` component should import. Client plugins must mirror the server
 * plugins in auth.ts.
 *
 * genericOAuth has no client plugin from Better Auth 1.7 (ENG-2343): it was rebuilt onto the
 * built-in social provider path, so `signIn.social({ provider })` drives Azure/OIDC/SAML too and
 * `signIn.oauth2` no longer exists.
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient(), oauthProviderClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
