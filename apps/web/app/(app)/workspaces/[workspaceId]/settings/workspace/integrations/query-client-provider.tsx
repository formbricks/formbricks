"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * There is no app-wide `QueryClientProvider` — each route segment that uses TanStack Query mounts its own,
 * as `tags/`, `surveys/` and `workflows/` do. The integration pages read their integration through
 * `useIntegration`, so they need one.
 */
export const IntegrationsQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
