"use client";

interface NextAuthProviderProps {
  children: React.ReactNode;
  sessionMaxAge: number;
}

/**
 * Better Auth's `useSession` (createAuthClient) fetches on demand and needs no React provider, so this
 * is now a passthrough. Kept (with its props) so the layout import stays stable until the Phase 7
 * cutover cleanup removes the wrapper. (ENG-1054)
 */
export const NextAuthProvider = ({ children }: NextAuthProviderProps) => {
  return <>{children}</>;
};
