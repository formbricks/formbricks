import { getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import { verifyPassword } from "@/modules/auth/lib/utils";
import { generateCommunityAvatar, generateUserAvatar } from "@/modules/auth/signup/lib/avatar";
import type { Account, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@formbricks/database";
import { ALCHEMY_API_KEY, EMAIL_VERIFICATION_DISABLED, ENCRYPTION_KEY } from "@formbricks/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@formbricks/lib/crypto";
import { verifyToken } from "@formbricks/lib/jwt";
import { createMembership } from "@formbricks/lib/membership/service";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { logger } from "@formbricks/logger";
import { TUser } from "@formbricks/types/user";
import { createBrevoCustomer } from "./brevo";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "alchemy",
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: "Alchemy",
      // The credentials is used to generate a suitable form on the sign in page.
      // You can specify whatever fields you are expecting to be submitted.
      // e.g. domain, username, password, 2FA token, etc.
      // You can pass any HTML attribute to the <input> tag through the object.
      credentials: {
        url: {
          label: "Url",
          type: "text",
          placeholder: "text",
        },
        body: {
          label: "Body",
          type: "text",
          placeholder: "text",
        },
        stampHeaderName: {
          label: "stampHeaderName",
          type: "text",
          placeholder: "text",
        },
        stampHeaderValue: {
          label: "stampHeaderValue",
          type: "text",
          placeholder: "text",
        },
      },
      async authorize(credentials, _req) {
        console.log("credentials");
        if (!credentials) {
          throw new Error("Invalid credentials");
        }
        let user;
        try {
          const options = {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              Authorization: `Bearer ${ALCHEMY_API_KEY}`,
            },
            body: JSON.stringify({
              stampedRequest: {
                stamp: {
                  stampHeaderName: credentials.stampHeaderName,
                  stampHeaderValue: credentials.stampHeaderValue,
                },
                url: credentials.url,
                body: credentials.body,
              },
            }),
          };

          const resp = await fetch("https://api.g.alchemy.com/signer/v1/whoami", options);
          const data: {
            email: string;
            userId: string;
            orgId: string;
            address: string;
            solanaAddress: string;
          } = await resp.json();

          if (!data.email || !data.address) {
            throw new Error("Invalid credentials");
          }

          user = await prisma.user.findUnique({
            where: {
              email: data.email,
            },
          });

          if (!user) {
            const avatarUrl = generateUserAvatar(data.email);
            const communityAvatarUrl = generateCommunityAvatar(data.email);
            user = await prisma.user.create({
              data: {
                email: data.email,
                name: "",
                emailVerified: new Date(),
                imageUrl: avatarUrl,
                communityAvatarUrl: communityAvatarUrl,
              },
            });
          }
          if (user) {
            const userOrganizations = await getOrganizationsByUserId(user.id);

            if (userOrganizations.length === 0) {
              const org = await prisma.organization.findFirst({});
              if (org) {
                await createMembership(org.id, user.id, { role: "member", accepted: true });
              }
            }
          }
        } catch (e) {
          logger.error(e, "Error in CredentialsProvider authorize");
          throw Error("Internal server error. Please try again later");
        }
        if (!user) {
          throw new Error("Invalid credentials");
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
        totpCode: { label: "Two-factor Code", type: "input", placeholder: "Code from authenticator app" },
        backupCode: { label: "Backup Code", type: "input", placeholder: "Two-factor backup code" },
      },
      async authorize(credentials, _req) {
        if (!credentials) {
          throw new Error("Invalid credentials");
        }
        let user;
        try {
          user = await prisma.user.findUnique({
            where: {
              email: credentials?.email,
            },
          });
        } catch (e) {
          logger.error(e, "Error in CredentialsProvider authorize");
          throw Error("Internal server error. Please try again later");
        }
        if (!user) {
          throw new Error("Invalid credentials");
        }
        if (!user.password) {
          throw new Error("User has no password stored");
        }

        const isValid = await verifyPassword(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        if (user.twoFactorEnabled && credentials.backupCode) {
          if (!ENCRYPTION_KEY) {
            logger.error("Missing encryption key; cannot proceed with backup code login.");
            throw new Error("Internal Server Error");
          }

          if (!user.backupCodes) throw new Error("No backup codes found");

          const backupCodes = JSON.parse(symmetricDecrypt(user.backupCodes, ENCRYPTION_KEY));

          // check if user-supplied code matches one
          const index = backupCodes.indexOf(credentials.backupCode.replaceAll("-", ""));
          if (index === -1) throw new Error("Invalid backup code");

          // delete verified backup code and re-encrypt remaining
          backupCodes[index] = null;
          await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              backupCodes: symmetricEncrypt(JSON.stringify(backupCodes), ENCRYPTION_KEY),
            },
          });
        } else if (user.twoFactorEnabled) {
          if (!credentials.totpCode) {
            throw new Error("second factor required");
          }

          if (!user.twoFactorSecret) {
            throw new Error("Internal Server Error");
          }

          if (!ENCRYPTION_KEY) {
            throw new Error("Internal Server Error");
          }

          const secret = symmetricDecrypt(user.twoFactorSecret, ENCRYPTION_KEY);
          if (secret.length !== 32) {
            throw new Error("Invalid two factor secret");
          }

          const isValidToken = (await import("./totp")).totpAuthenticatorCheck(credentials.totpCode, secret);
          if (!isValidToken) {
            throw new Error("Invalid two factor code");
          }
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
          throw new Error("Either a user does not match the provided token or the token is invalid");
        }

        if (!user) {
          throw new Error("Either a user does not match the provided token or the token is invalid");
        }

        if (user.emailVerified) {
          throw new Error("Email already verified");
        }

        user = await updateUser(user.id, { emailVerified: new Date() });

        // send new user to brevo after email verification
        createBrevoCustomer({ id: user.id, email: user.email });

        return user;
      },
    }),
  ],
  session: {
    maxAge: 24 * 3600,
  },
  callbacks: {
    async jwt({ token }) {
      const existingUser = await getUserByEmail(token?.email!);

      if (!existingUser) {
        return token;
      }

      return {
        ...token,
        profile: { id: existingUser.id },
      };
    },
    async session({ session, token }) {
      // @ts-expect-error
      session.user.id = token?.id;
      // @ts-expect-error
      session.user = token.profile;

      return session;
    },
    async signIn({ user, account }: { user: TUser; account: Account }) {
      if (account?.provider === "credentials" || account?.provider === "token") {
        // check if user's email is verified or not
        if (!user.emailVerified && !EMAIL_VERIFICATION_DISABLED) {
          throw new Error("Email Verification is Pending");
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
