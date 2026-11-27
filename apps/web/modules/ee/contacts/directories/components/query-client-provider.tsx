"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/** Feature-scoped query client for Organization settings › Contact directories. */
export const ContactDirectoriesQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }));

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
