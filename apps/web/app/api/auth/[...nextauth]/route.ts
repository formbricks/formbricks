import { authOptions } from "@/modules/auth/lib/authOptions";
import NextAuth from "next-auth";

export const fetchCache = "force-no-store";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
