"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * Feature-scoped query client for the feedback-directory settings. There is no app-wide provider —
 * each feature owns one (see the charts and taxonomy equivalents).
 */
export const FeedbackDirectoryQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }));

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
