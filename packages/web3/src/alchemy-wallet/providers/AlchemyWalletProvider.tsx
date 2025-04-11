// @ts-nocheck
"use client";

import { AlchemyAccountProvider, Hydrate } from "@account-kit/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { alchemyConfig, queryClient } from "../lib/config";

// @ts-nocheck

// @ts-nocheck

// @ts-nocheck

export const AlchemyWalletProvider = (props: { children: ReactNode; apiKey: string }) => {
  const config = alchemyConfig(props.apiKey);
  return (
    <QueryClientProvider client={queryClient}>
      <AlchemyAccountProvider config={config} queryClient={queryClient}>
        {props.children}
      </AlchemyAccountProvider>
    </QueryClientProvider>
  );
};
