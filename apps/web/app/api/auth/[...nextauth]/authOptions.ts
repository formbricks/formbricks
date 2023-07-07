import { verifyPassword } from "@/lib/auth";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@formbricks/database";
import type { IdentityProvider } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

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
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      const existingUser = await prisma.user.findFirst({
        where: { email: token.email! },
        select: {
          id: true,
          createdAt: true,
          onboardingCompleted: true,
          memberships: {
            select: {
              teamId: true,
              team: {
                select: {
                  plan: true,
                },
              },
            },
          },
          name: true,
        },
      });

      if (!existingUser) {
        return token;
      }

      const additionalAttributs = {
        id: existingUser.id,
        createdAt: existingUser.createdAt,
        onboardingCompleted: existingUser.onboardingCompleted,
        teamId: existingUser.memberships.length > 0 ? existingUser.memberships[0].teamId : undefined,
        plan:
          existingUser.memberships.length > 0 && existingUser.memberships[0].team
            ? existingUser.memberships[0].team.plan
            : undefined,
        name: existingUser.name,
      };

      return {
        ...token,
        ...additionalAttributs,
      };
    },
    async session({ session, token }) {
      // @ts-ignore
      session.user.id = token?.id;
      // @ts-ignore
      session.user.createdAt = token?.createdAt ? new Date(token?.createdAt).toISOString() : undefined;
      // @ts-ignore
      session.user.onboardingCompleted = token?.onboardingCompleted;
      // @ts-ignore
      session.user.teamId = token?.teamId;
      // @ts-ignore
      session.user.plan = token?.plan;
      session.user.name = token.name || "";

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
            onboardingCompleted: false,
            identityProvider: provider,
            identityProviderAccountId: user.id as string,
            accounts: {
              create: [{ ...account }],
            },
            memberships: {
              create: [
                {
                  accepted: true,
                  role: "owner",
                  team: {
                    create: {
                      name: `${user.name}'s Team`,
                      products: {
                        create: [
                          {
                            name: "My Product",
                            environments: {
                              create: [
                                {
                                  type: "production",
                                  eventClasses: {
                                    create: [
                                      {
                                        name: "New Session",
                                        description: "Gets fired when a new session is created",
                                        type: "automatic",
                                      },
                                      {
                                        name: "Exit Intent (Desktop)",
                                        description: "A user on Desktop leaves the website with the cursor.",
                                        type: "automatic",
                                      },
                                      {
                                        name: "50% Scroll",
                                        description: "A user scrolled 50% of the current page",
                                        type: "automatic",
                                      },
                                    ],
                                  },
                                  attributeClasses: {
                                    create: [
                                      {
                                        name: "userId",
                                        description: "The internal ID of the person",
                                        type: "automatic",
                                      },
                                      {
                                        name: "email",
                                        description: "The email of the person",
                                        type: "automatic",
                                      },
                                    ],
                                  },
                                },
                                {
                                  type: "development",
                                  eventClasses: {
                                    create: [
                                      {
                                        name: "New Session",
                                        description: "Gets fired when a new session is created",
                                        type: "automatic",
                                      },
                                      {
                                        name: "Exit Intent (Desktop)",
                                        description: "A user on Desktop leaves the website with the cursor.",
                                        type: "automatic",
                                      },
                                      {
                                        name: "50% Scroll",
                                        description: "A user scrolled 50% of the current page",
                                        type: "automatic",
                                      },
                                    ],
                                  },
                                  attributeClasses: {
                                    create: [
                                      {
                                        name: "userId",
                                        description: "The internal ID of the person",
                                        type: "automatic",
                                      },
                                      {
                                        name: "email",
                                        description: "The email of the person",
                                        type: "automatic",
                                      },
                                    ],
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
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
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/login", // Error code passed in query string as ?error=
  },
};
