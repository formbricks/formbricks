// @ts-nocheck
"use client";

import { AlchemyClientState } from "@account-kit/core";
import { AlchemyAccountProvider, Hydrate } from "@account-kit/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { alchemyConfig, queryClient } from "../lib/config";

// @ts-nocheck

export const AlchemyWalletProvider = (props: { initialState?: AlchemyClientState; children: ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AlchemyAccountProvider
        config={alchemyConfig}
        queryClient={queryClient}
        initialState={props.initialState}>
        <Hydrate config={alchemyConfig} initialState={props.initialState}>
          {props.children}
        </Hydrate>
      </AlchemyAccountProvider>
    </QueryClientProvider>
  );
};
