"use client";

import { SessionProvider, SessionProviderProps } from "next-auth/react";

export default function ClientSessionProvider(props: SessionProviderProps) {
  return <SessionProvider {...props} />;
}
