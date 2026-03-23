"use client";

import { SessionProvider } from "next-auth/react";

interface NextAuthProviderProps {
  children: React.ReactNode;
  sessionMaxAge: number;
}

export const NextAuthProvider = ({ children, sessionMaxAge }: NextAuthProviderProps) => {
  // Refresh at 1/3 of session max age, capped at 5 minutes
  const refetchInterval = Math.min(Math.floor(sessionMaxAge / 3), 300);

  return <SessionProvider refetchInterval={refetchInterval}>{children}</SessionProvider>;
};
