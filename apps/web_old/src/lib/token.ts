import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is missing");
}

export const getToken = async () => {
  return await decode({
    token: cookies()
      .getAll()
      .find((cookie) => cookie.name.includes("next-auth.session-token"))?.value,
    secret: process.env.NEXTAUTH_SECRET as string,
  });
};
