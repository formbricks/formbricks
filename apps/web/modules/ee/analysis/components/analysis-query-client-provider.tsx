"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * One query cache for everything under the analysis routes, so the chart list, the dashboards and the
 * chart builder dialogs read and invalidate the same entries — a chart saved in a dialog updates the list
 * behind it without a page refresh.
 */
export const AnalysisQueryClientProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
