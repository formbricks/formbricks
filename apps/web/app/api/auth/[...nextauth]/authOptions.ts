import { env } from "@/env.mjs";
import { verifyPassword } from "@/lib/auth";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@formbricks/database";
import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
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
          throw new Error("Either a user does not match the provided token or the token is invalid");
        }

        if (!user) {
          throw new Error("Either a user does not match the provided token or the token is invalid");
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
      clientId: env.GITHUB_ID || "",
      clientSecret: env.GITHUB_SECRET || "",
    }),
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID || "",
      clientSecret: env.GOOGLE_CLIENT_SECRET || "",
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
              role: true,
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

      const teams = existingUser.memberships.map((membership) => ({
        id: membership.teamId,
        role: membership.role,
        plan: membership.team.plan,
      }));

      const additionalAttributs = {
        id: existingUser.id,
        createdAt: existingUser.createdAt,
        onboardingCompleted: existingUser.onboardingCompleted,
        teams,
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
      session.user.teams = token?.teams;
      session.user.name = token.name || "";

      return session;
    },
    async signIn({ user, account }: any) {
      if (account.provider === "credentials" || account.provider === "token") {
        if (!user.emailVerified && env.NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED !== "1") {
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
          return "/auth/login?error=Looks%20like%20you%20updated%20your%20email%20somewhere%20else.%0AA%20user%20with%20this%20new%20email%20exists%20already.";
        }

        // There is no existing account for this identity provider / account id
        // check if user account with this email already exists
        // if user already exists throw error and request password login
        const existingUserWithEmail = await prisma.user.findFirst({
          where: { email: user.email },
        });

        if (existingUserWithEmail) {
          return "/auth/login?error=A%20user%20with%20this%20email%20exists%20already.";
        }

        const createdUser = await prisma.user.create({
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
          include: {
            memberships: true,
          },
        });

        const teamId = createdUser.memberships?.[0]?.teamId;
        if (teamId) {
          fetch(`${WEBAPP_URL}/api/v1/teams/${teamId}/add_demo_product`, {
            method: "POST",
            headers: {
              "x-api-key": INTERNAL_SECRET,
            },
          });
        }

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
