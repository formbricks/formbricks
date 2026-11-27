"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/** Feature-scoped query client for the team settings (team dashboard limits, ENG-7483). */
export const TeamsQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }));

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
