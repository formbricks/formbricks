"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * There is no app-wide `QueryClientProvider` — each route segment that uses TanStack Query mounts its
 * own, as `surveys/`, `workflows/` and the onboarding template pages do. The tags settings page is the
 * first query consumer under `settings/`, so it needs one: without it `useTags` throws on render and the
 * route falls back to the "Error loading resources" boundary.
 */
export const TagsQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
