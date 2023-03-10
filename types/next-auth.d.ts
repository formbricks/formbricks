import NextAuth from "next-auth";
import { Address } from "@prisma/client";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
    interface Session {
        user: {
            id: number;
            firstname: string;
            lastname: string;
            email: string;
            phone: string;
            role: string;
            gender: string;
            photo: string;
            profileIsValid: boolean;
            whatsapp: string;
            address: Address;
            dob: Date;
        }
    }
}

