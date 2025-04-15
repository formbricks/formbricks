import { CONFIG } from "@wonderchain/sdk";
import { useMemo } from "react";
import { useChainId } from "./useChainId";

export const useConfig = () => {
  const chainId = useChainId();
  const config = useMemo(() => {
    return CONFIG[chainId];
  }, [chainId]);
  return { config };
};
