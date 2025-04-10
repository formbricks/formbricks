"use client";

import { useEffect } from "react";
import { useDeployERC20 } from "@/modules/alchemy-wallet/hooks/useDeployERC20";

export const WalletEventBridge = () => {
  const { deploy } = useDeployERC20();

  useEffect(() => {
    const handler = (e: CustomEvent<{
      tokenName: string;
      tokenSymbol: string;
      initialSupply: number;
    }>) => {
      const { tokenName, tokenSymbol, initialSupply } = e.detail;
      deploy(tokenName, tokenSymbol, initialSupply);
    };

    window.addEventListener("deployWalletAction", handler as EventListener);

    return () => {
      window.removeEventListener("deployWalletAction", handler as EventListener);
    };
  }, [deploy]);

  return null;
};
