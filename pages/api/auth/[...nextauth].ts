import { NextApiRequest, NextApiResponse } from "next";
import getConfig from "next/config";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "../../../lib/prisma";
import { verifyPassword } from "../../../lib/auth";
import { verifyToken } from "../../../lib/jwt";

const { publicRuntimeConfig } = getConfig();

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  return await NextAuth(req, res, {
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

          const isValid = await verifyPassword(
            credentials.password,
            user.password
          );

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
            const { id } = await verifyToken(credentials?.token)
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
    ],
    callbacks: {
      async signIn({ user }) {
        if (user.emailVerified || publicRuntimeConfig.emailVerificationDisabled) {
          return true;
        } else {
          // Return false to display a default error message or you can return a URL to redirect to
          return `/auth/verification-requested?email=${encodeURIComponent(
            user.email
          )}`;
        }
      },
    },
    pages: {
      signIn: "/auth/signin",
      signOut: "/auth/logout",
      error: "/auth/signin", // Error code passed in query string as ?error=
    },
  });
}
