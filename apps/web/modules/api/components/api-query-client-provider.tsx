"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { makeQueryClient } from "@/modules/api/lib/query-client";

/**
 * A TanStack Query provider with the app's house defaults (`makeQueryClient`). Created in `useState`, so it
 * survives re-renders but is never shared between requests or users. Mount it at the route layout or page of
 * a feature that reads or writes through the dashboard API.
 */
export const ApiQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
