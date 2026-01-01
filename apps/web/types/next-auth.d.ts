import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      isActive: boolean;
    } & DefaultSession["user"];
  }
}
