"use client";

import { createContext, useEffect, useState } from "react";

interface nativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

interface Chain {
  chain: string;
  chainId: number;
  name: string;
  nativeCurrency: nativeCurrency;
}

export const ChainContext = createContext<Chain[] | null>(null);

export function ChainProvider({ children }) {
  const [chains, setChains] = useState(null);

  useEffect(() => {
    const fetchChains = async () => {
      try {
        const response = await fetch("https://chainid.network/chains.json");
        const data = await response.json();
        setChains(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchChains();
  }, []);

  return <ChainContext.Provider value={chains}>{children}</ChainContext.Provider>;
}
