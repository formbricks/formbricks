import { IdentityProvider } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { verifyPassword } from "../../../lib/auth";
import { verifyToken } from "../../../lib/jwt";

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

        if (!user) {
          throw new Error("User not found");
        }
        if (!credentials) {
          throw new Error("No credentials");
        }
        if (!user.password) {
          throw new Error("Incorrect password");
        }

        const isValid = await verifyPassword(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Incorrect password");
        }

        return {
          id: user.id,
          email: user.email,
          firstname: user.firstname,
          lastname: user.firstname,
          emailVerified: user.emailVerified,
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
          const { id } = await verifyToken(credentials?.token);
          user = await prisma.user.findUnique({
            where: {
              id: id,
            },
          });
        } catch (e) {
          console.error(e);
          throw new Error("Token is not valid or expired");
        }

        if (!user) {
          throw new Error("User not found");
        }

        if (user.emailVerified) {
          throw new Error("Email already verified");
        }

        user = await prisma.user.update({
          where: {
            id: user.id,
          },
          data: { emailVerified: new Date().toISOString() },
        });

        return {
          id: user.id,
          email: user.email,
          firstname: user.firstname,
          lastname: user.firstname,
          emailVerified: user.emailVerified,
        };
      },
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      const existingUser = await prisma.user.findFirst({
        where: { email: token.email! },
        select: {
          id: true,
          name: true,
        },
      });

      if (!existingUser) {
        return token;
      }

      return {
        ...existingUser,
        ...token,
      };
    },
    async session({ session, token }) {
      // @ts-ignore
      session.user.id = token.id;
      session.user.name = token.name;

      return session;
    },
    async signIn({ user, account }: any) {
      if (account.provider === "credentials" || account.provider === "token") {
        if (!user.emailVerified && process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED !== "1") {
          return `/auth/verification-requested?email=${encodeURIComponent(user.email)}`;
        }
        return true;
      }

      if (!user.email || !user.name || account.type !== "oauth") {
        return false;
      }

      if (account.provider) {
        const provider = account.provider.toLowerCase() as IdentityProvider;
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
          const otherUserWithEmail = await prisma.user.findFirst({
            where: { email: user.email },
          });

          if (!otherUserWithEmail) {
            await prisma.user.update({
              where: { id: existingUserWithAccount.id },
              data: { email: user.email },
            });
            return true;
          }
          return "/auth/error?error=email-conflict";
        }

        // There is no existing account for this identity provider / account id
        // check if user account with this email already exists
        // if user already exists throw error and request password login
        const existingUserWithEmail = await prisma.user.findFirst({
          where: { email: user.email },
        });

        if (existingUserWithEmail) {
          return "/auth/error?error=use-email-login";
        }

        await prisma.user.create({
          data: {
            name: user.name,
            email: user.email,
            emailVerified: new Date(Date.now()),
            identityProvider: provider,
            identityProviderAccountId: user.id as string,
            accounts: {
              create: [{ ...account }],
            },
            organisations: {
              create: [
                {
                  accepted: true,
                  role: "owner",
                  organisation: {
                    create: {
                      name: `${user.name}'s Organisation`,
                    },
                  },
                },
              ],
            },
          },
        });

        return true;
      }

      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/logout",
    error: "/auth/signin", // Error code passed in query string as ?error=
  },
};

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  return await NextAuth(req, res, authOptions);
}
