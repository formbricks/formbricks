import NextAuth from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      createdAt: string;
      teamId?: string;
      plan?: string;
      email: string;
      name: string;
      onboardingCompleted: boolean;
      image?: StaticImageData;
    };
  }
}
