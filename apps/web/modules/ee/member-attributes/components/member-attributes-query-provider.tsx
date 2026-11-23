"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * The query cache of the Teams settings page (ENG-7474): the Members table, Member settings, the CSV import
 * and the Member attributes section share it, so a change in one shows in the others.
 */
export const MemberAttributesQueryProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { staleTime: 30_000 } } })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
