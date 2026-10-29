"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * The shell's TanStack Query client. Server data that the shell fetches from `/api/v3` lives in this cache
 * rather than in component state. Mutations are never retried: a retried create would spend the server's
 * rate limit and could duplicate what it creates.
 */
export const ShellQueryProvider = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
