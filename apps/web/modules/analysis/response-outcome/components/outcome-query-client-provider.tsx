"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/** One QueryClient per responses page, kept across re-renders and never shared between requests. */
export const OutcomeQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
