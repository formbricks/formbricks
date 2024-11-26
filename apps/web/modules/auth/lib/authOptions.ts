import { getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import { verifyPassword } from "@/modules/auth/lib/utils";
import { getSSOProviders } from "@/modules/ee/sso/lib/providers";
import { handleSSOCallback } from "@/modules/ee/sso/lib/sso-handlers";
import type { Account, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@formbricks/database";
import {
  EMAIL_VERIFICATION_DISABLED,
  ENCRYPTION_KEY,
  ENTERPRISE_LICENSE_KEY,
} from "@formbricks/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@formbricks/lib/crypto";
import { verifyToken } from "@formbricks/lib/jwt";
import { TUser } from "@formbricks/types/user";

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
        totpCode: { label: "Two-factor Code", type: "input", placeholder: "Code from authenticator app" },
        backupCode: { label: "Backup Code", type: "input", placeholder: "Two-factor backup code" },
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
          throw new Error("Invalid credentials");
        }
        if (!user.password) {
          throw new Error("Invalid credentials");
        }

        const isValid = await verifyPassword(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        if (user.twoFactorEnabled && credentials.backupCode) {
          if (!ENCRYPTION_KEY) {
            console.error("Missing encryption key; cannot proceed with backup code login.");
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
            throw new Error("Internal Server Error");
          }

          const isValidToken = (await import("./totp")).totpAuthenticatorCheck(credentials.totpCode, secret);
          if (!isValidToken) {
            throw new Error("Invalid second factor code");
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
    // Conditionally add enterprise SSO providers
    ...(ENTERPRISE_LICENSE_KEY ? getSSOProviders() : []),
  ],
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
      if (ENTERPRISE_LICENSE_KEY) {
        return handleSSOCallback({ user, account });
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
