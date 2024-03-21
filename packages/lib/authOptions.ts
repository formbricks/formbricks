import type { IdentityProvider } from "@prisma/client";
import { type NextAuthOptions, getServerSession } from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import SlackProvider from "next-auth/providers/slack";

import { prisma } from "@formbricks/database";

import { createAccount } from "./account/service";
import { verifyPassword } from "./auth/util";
import {
  AZUREAD_CLIENT_ID,
  AZUREAD_CLIENT_SECRET,
  AZUREAD_TENANT_ID,
  DEFAULT_TEAM_ID,
  DEFAULT_TEAM_ROLE,
  EMAIL_VERIFICATION_DISABLED,
  GITHUB_ID,
  GITHUB_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  OIDC_DISPLAY_NAME,
  OIDC_ISSUER,
  OIDC_SIGNING_ALGORITHM,
  SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET,
} from "./constants";
import { verifyToken } from "./jwt";
import { createMembership } from "./membership/service";
import { createProduct } from "./product/service";
import { createTeam, getTeam } from "./team/service";
import { createUser, getUserByEmail, updateUser } from "./user/service";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: "Credentials",
      // The credentials is used to generate a suitable form on the sign in page.
      // You can specify whatever fields you are expecting to be submitted.
      // e.g. domain, username, password, 2FA token, etc.
      // You can pass any HTML attribute to the <input> tag through the object.
      credentials: {
        email: {
          label: "Email Address",
          type: "email",
          placeholder: "Your email address",
        },
        password: {
          label: "Password",
          type: "password",
          placeholder: "Your password",
        },
      },
      async authorize(credentials, _req) {
        let user;
        try {
          user = await prisma.user.findUnique({
            where: {
              email: credentials?.email,
            },
          });
        } catch (e) {
          console.error(e);
          throw Error("Internal server error. Please try again later");
        }

        if (!user || !credentials) {
          throw new Error("No user matches the provided credentials");
        }
        if (!user.password) {
          throw new Error("No user matches the provided credentials");
        }

        const isValid = await verifyPassword(credentials.password, user.password);

        if (!isValid) {
          throw new Error("No user matches the provided credentials");
        }

        return {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          imageUrl: user.imageUrl,
        };
      },
    }),
    CredentialsProvider({
      id: "token",
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: "Token",
      // The credentials is used to generate a suitable form on the sign in page.
      // You can specify whatever fields you are expecting to be submitted.
      // e.g. domain, username, password, 2FA token, etc.
      // You can pass any HTML attribute to the <input> tag through the object.
      credentials: {
        token: {
          label: "Verification Token",
          type: "string",
        },
      },
      async authorize(credentials, _req) {
        let user;
        try {
          if (!credentials?.token) {
            throw new Error("Token not found");
          }
          const { id } = await verifyToken(credentials?.token);
          user = await prisma.user.findUnique({
            where: {
              id: id,
            },
          });
        } catch (e) {
          console.error(e);
          throw new Error("Either a user does not match the provided token or the token is invalid");
        }

        if (!user) {
          throw new Error("Either a user does not match the provided token or the token is invalid");
        }

        if (user.emailVerified) {
          throw new Error("Email already verified");
        }

        user = await updateUser(user.id, { emailVerified: new Date() });

        return user;
      },
    }),
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
    SlackProvider({
      clientId: SLACK_CLIENT_ID as string,
      clientSecret: SLACK_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
      wellKnown: "",
      token: {
        async request(context) {
          const formData = new URLSearchParams();
          formData.append("code", context.params.code ?? "");
          formData.append("client_id", context.provider.clientId ?? "");
          formData.append("client_secret", context.provider.clientSecret ?? "");

          const session = await getServerSession(authOptions);

          try {
            const response = await fetch("https://slack.com/api/oauth.v2.access", {
              method: "POST",
              body: formData,
            });

            const data = await response.json();
            return {
              tokens: {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_at: data.expires_in,
                user_id: data.bot_user_id,
                id: data.team.id,
                name: data.team.name,
                email: session?.user?.email,
              },
            };
          } catch (error) {
            throw error;
          }
        },
      },
      userinfo: {
        // @ts-expect-error
        async request() {
          const session = await getServerSession(authOptions);

          return {
            sub: "bot_user",
            ...session?.user,
          };
        },
      },
      authorization: {
        url: "https://slack.com/oauth/v2/authorize",
        params: {
          scope:
            "channels:read,chat:write,chat:write.public,groups:read,mpim:read,im:read,users:read,users.profile:read,users:read.email",
        },
      },
      idToken: false,
    }),
    {
      id: "openid",
      name: OIDC_DISPLAY_NAME || "OpenId",
      type: "oauth",
      clientId: OIDC_CLIENT_ID || "",
      clientSecret: OIDC_CLIENT_SECRET || "",
      wellKnown: `${OIDC_ISSUER}/.well-known/openid-configuration`,
      authorization: { params: { scope: "openid email profile" } },
      idToken: true,
      client: {
        id_token_signed_response_alg: OIDC_SIGNING_ALGORITHM || "RS256",
      },
      checks: ["pkce", "state"],
      profile: (profile) => {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account }) {
      let slackAttributes = {};
      if (account && account.provider && account.provider === "slack") {
        slackAttributes = {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          email: account?.email,
          name: account?.name,
          id: account?.id,
          expiresAt: account.expires_at,
          provider: account.provider,
        };
      }
      const existingUser = await getUserByEmail(token?.email as string);

      if (!existingUser) {
        return token;
      }
      return {
        ...token,
        profile: existingUser || null,
        slack: (token && token?.slack) ?? slackAttributes,
      };
    },
    async session({ session, token }) {
      // @ts-expect-error
      session.user.id = token?.id;
      // @ts-expect-error
      session.user = token?.profile;

      return {
        ...session,
        slack: {
          // @ts-expect-error
          id: token.slack?.id,
          // @ts-expect-error
          accessToken: token.slack?.accessToken,
          // @ts-expect-error
          refreshToken: token.slack?.refreshToken,
          // @ts-expect-error
          expiresAt: token.slack?.expiresAt,
          // @ts-expect-error
          email: token.slack?.email,
          // @ts-expect-error
          name: token.slack?.name,
        },
      };
    },
    async signIn({ user, account }: any) {
      if (account.provider === "credentials" || account.provider === "token") {
        if (!user.emailVerified && !EMAIL_VERIFICATION_DISABLED) {
          throw new Error("Email Verification is Pending");
        }
        return true;
      }

      if (!user.email || account.type !== "oauth") {
        return false;
      }

      if (account.provider) {
        if (account.provider === "slack") {
          return true;
        }
        const provider = account.provider.toLowerCase().replace("-", "") as IdentityProvider;
        // check if accounts for this provider / account Id already exists
        const existingUserWithAccount = await prisma.user.findFirst({
          include: {
            accounts: {
              where: {
                provider: account.provider,
              },
            },
          },
          where: {
            identityProvider: provider,
            identityProviderAccountId: account.providerAccountId,
          },
        });

        if (existingUserWithAccount) {
          // User with this provider found
          // check if email still the same
          if (existingUserWithAccount.email === user.email) {
            return true;
          }

          // user seemed to change his email within the provider
          // check if user with this email already exist
          // if not found just update user with new email address
          // if found throw an error (TODO find better solution)
          const otherUserWithEmail = await getUserByEmail(user.email);

          if (!otherUserWithEmail) {
            await updateUser(existingUserWithAccount.id, { email: user.email });
            return true;
          }
          throw new Error(
            "Looks like you updated your email somewhere else. A user with this new email exists already."
          );
        }

        // There is no existing account for this identity provider / account id
        // check if user account with this email already exists
        // if user already exists throw error and request password login
        const existingUserWithEmail = await getUserByEmail(user.email);

        if (existingUserWithEmail) {
          throw new Error("A user with this email exists already.");
        }

        const userProfile = await createUser({
          name: user.name || user.email.split("@")[0],
          email: user.email,
          emailVerified: new Date(Date.now()),
          onboardingCompleted: false,
          identityProvider: provider,
          identityProviderAccountId: account.providerAccountId,
        });

        // Default team assignment if env variable is set
        if (DEFAULT_TEAM_ID && DEFAULT_TEAM_ID.length > 0) {
          // check if team exists
          let team = await getTeam(DEFAULT_TEAM_ID);
          let isNewTeam = false;
          if (!team) {
            // create team with id from env
            team = await createTeam({ id: DEFAULT_TEAM_ID, name: userProfile.name + "'s Team" });
            isNewTeam = true;
          }
          const role = isNewTeam ? "owner" : DEFAULT_TEAM_ROLE || "admin";
          await createMembership(team.id, userProfile.id, { role, accepted: true });
          await createAccount({
            ...account,
            userId: userProfile.id,
          });
          return true;
        }
        // Without default team assignment
        else {
          const team = await createTeam({ name: userProfile.name + "'s Team" });
          await createMembership(team.id, userProfile.id, { role: "owner", accepted: true });
          await createAccount({
            ...account,
            userId: userProfile.id,
          });
          const product = await createProduct(team.id, { name: "My Product" });
          const updatedNotificationSettings = {
            ...userProfile.notificationSettings,
            alert: {
              ...userProfile.notificationSettings?.alert,
            },
            weeklySummary: {
              ...userProfile.notificationSettings?.weeklySummary,
              [product.id]: true,
            },
          };

          await updateUser(userProfile.id, {
            notificationSettings: updatedNotificationSettings,
          });

          return true;
        }
      }

      return true;
    },
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/login", // Error code passed in query string as ?error=
  },
};
