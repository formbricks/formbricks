"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * There is no app-wide `QueryClientProvider`: each route segment that uses TanStack Query mounts its own.
 * Authorized apps reads and edits grants through `/api/internal/mcp-grants` (ENG-7152).
 */
export const AuthorizedAppsQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
