"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/** Feature-scoped React Query provider for the topics/subtopics view. Created once per mount so the
 * cache survives re-renders but isn't shared across requests. */
export const TopicsSubtopicsQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
