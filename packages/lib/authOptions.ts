import type { IdentityProvider } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

import { prisma } from "@formbricks/database";

import { createAccount } from "./account/service";
import { verifyPassword } from "./auth/util";
import { EMAIL_VERIFICATION_DISABLED } from "./constants";
import { env } from "./env.mjs";
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
      clientId: env.GITHUB_ID || "",
      clientSecret: env.GITHUB_SECRET || "",
    }),
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID || "",
      clientSecret: env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
    AzureAD({
      clientId: env.AZUREAD_CLIENT_ID || "",
      clientSecret: env.AZUREAD_CLIENT_SECRET || "",
      tenantId: env.AZUREAD_TENANT_ID || "",
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      const existingUser = await getUserByEmail(token?.email!);

      if (!existingUser) {
        return token;
      }

      return {
        ...token,
        profile: existingUser || null,
      };
    },
    async session({ session, token }) {
      // @ts-expect-error
      session.user.id = token?.id;
      // @ts-expect-error
      session.user = token.profile;

      return session;
    },
    async signIn({ user, account }: any) {
      if (account.provider === "credentials" || account.provider === "token") {
        if (!user.emailVerified && !EMAIL_VERIFICATION_DISABLED) {
          throw new Error("Email Verification is Pending");
        }
        return true;
      }

      if (!user.email || !user.name || account.type !== "oauth") {
        return false;
      }

      if (account.provider) {
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
          name: user.name,
          email: user.email,
          emailVerified: new Date(Date.now()),
          onboardingCompleted: false,
          identityProvider: provider,
          identityProviderAccountId: account.providerAccountId,
        });
        // Default team assignment if env variable is set
        if (env.DEFAULT_TEAM_ID && env.DEFAULT_TEAM_ID.length > 0) {
          // check if team exists
          let team = await getTeam(env.DEFAULT_TEAM_ID);
          let isNewTeam = false;
          if (!team) {
            // create team with id from env
            team = await createTeam({ id: env.DEFAULT_TEAM_ID, name: userProfile.name + "'s Team" });
            isNewTeam = true;
          }
          const role = isNewTeam ? "owner" : env.DEFAULT_TEAM_ROLE || "admin";
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
