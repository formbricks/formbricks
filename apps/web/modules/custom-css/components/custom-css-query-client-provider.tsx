"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * There is no app-wide `QueryClientProvider` — each route that uses TanStack Query mounts its own. The
 * Look & Feel page's theme editor reads and validates workspace Custom CSS through `/api/v3`, so it is
 * wrapped in one. (The survey editor's route group already mounts `SurveysQueryClientProvider`.)
 */
export const CustomCssQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
