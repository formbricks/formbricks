"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { retryUnlessClientError } from "@/modules/api/lib/v3-client";

/**
 * One query cache for everything under the analysis routes, so the chart list, the dashboards and the
 * chart builder dialogs read and invalidate the same entries — a chart saved in a dialog updates the list
 * behind it without a page refresh. Reads are not retried on a 4xx (see `retryUnlessClientError`).
 */
export const AnalysisQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: retryUnlessClientError(3) } } })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
