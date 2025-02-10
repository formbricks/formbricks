import type { IdentityProvider } from "@prisma/client";
import AzureAD from "next-auth/providers/azure-ad";
import BoxyHQSAMLProvider from "next-auth/providers/boxyhq-saml";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import {
  AZUREAD_CLIENT_ID,
  AZUREAD_CLIENT_SECRET,
  AZUREAD_TENANT_ID,
  GITHUB_ID,
  GITHUB_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  OIDC_DISPLAY_NAME,
  OIDC_ISSUER,
  OIDC_SIGNING_ALGORITHM,
  WEBAPP_URL,
} from "@formbricks/lib/constants";

export const getSSOProviders = () => [
  GitHubProvider({
    clientId: GITHUB_ID || "",
    clientSecret: GITHUB_SECRET || "",
  }),
  GoogleProvider({
    clientId: GOOGLE_CLIENT_ID || "",
    clientSecret: GOOGLE_CLIENT_SECRET || "",
    allowDangerousEmailAccountLinking: true,
  }),
  AzureAD({
    clientId: AZUREAD_CLIENT_ID || "",
    clientSecret: AZUREAD_CLIENT_SECRET || "",
    tenantId: AZUREAD_TENANT_ID || "",
  }),
  {
    id: "openid",
    name: OIDC_DISPLAY_NAME || "OpenId",
    type: "oauth" as const,
    clientId: OIDC_CLIENT_ID || "",
    clientSecret: OIDC_CLIENT_SECRET || "",
    wellKnown: `${OIDC_ISSUER}/.well-known/openid-configuration`,
    authorization: { params: { scope: "openid email profile" } },
    idToken: true,
    client: {
      id_token_signed_response_alg: OIDC_SIGNING_ALGORITHM || "RS256",
    },
    checks: ["pkce" as const, "state" as const],
    profile: (profile) => {
      return {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: profile.picture,
      };
    },
  },
  BoxyHQSAMLProvider({
    authorization: {
      url: `${WEBAPP_URL}/api/auth/saml/authorize`,
      params: {
        scope: "",
        response_type: "code",
        provider: "saml",
      },
    },
    token: {
      url: `${WEBAPP_URL}/api/auth/saml/token`,
      params: { grant_type: "authorization_code" },
    },
    userinfo: `${WEBAPP_URL}/api/auth/saml/userinfo`,
    issuer: `${process.env.NEXTAUTH_URL}`,
    clientId: "dummy",
    clientSecret: "dummy",
    httpOptions: {
      timeout: 30000,
    },
  }),
];

export type { IdentityProvider };
