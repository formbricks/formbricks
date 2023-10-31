import NextAuth from "next-auth";
import { TProfile } from "./profile";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: TProfile;
  }
}
