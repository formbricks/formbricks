// @ts-nocheck
"use client";

import { AlchemyClientState } from "@account-kit/core";
import { AlchemyAccountProvider, Hydrate } from "@account-kit/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { alchemyConfig, queryClient } from "../lib/config";

// @ts-nocheck

// @ts-nocheck

export const AlchemyWalletProvider = (props: {
  initialState?: AlchemyClientState;
  children: ReactNode;
  apiKey: string;
}) => {
  const config = alchemyConfig(props.apiKey);
  return (
    <QueryClientProvider client={queryClient}>
      <AlchemyAccountProvider config={config} queryClient={queryClient} initialState={props.initialState}>
        <Hydrate config={config} initialState={props.initialState}>
          {props.children}
        </Hydrate>
      </AlchemyAccountProvider>
    </QueryClientProvider>
  );
};
