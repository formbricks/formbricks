import { NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "../../../lib/prisma";
import { verifyPassword } from "../../../lib/auth";

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  return await NextAuth(req, res, {
    providers: [
      CredentialsProvider({
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
            placeholder: "lisa@example.com",
          },
          password: {
            label: "Password",
            type: "password",
            placeholder: "Your super secure password",
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
            name: user.name,
          };
        },
      }),
    ],
    secret: process.env.SECRET,
    pages: {
      signIn: "/auth/signin",
      signOut: "/auth/logout",
      error: "/auth/signin", // Error code passed in query string as ?error=
    },
  });
}
