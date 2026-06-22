"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

interface WorkflowsQueryClientProviderProps {
  children: ReactNode;
}

export const WorkflowsQueryClientProvider = ({ children }: Readonly<WorkflowsQueryClientProviderProps>) => {
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
