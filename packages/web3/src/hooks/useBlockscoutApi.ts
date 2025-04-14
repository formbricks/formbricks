import { getBlockscoutApi } from "@wonderchain/sdk";
import { useMemo } from "react";
import { useChainId } from "./useChainId";

export const useBlockscoutApi = () => {
  const chainId = useChainId();
  return useMemo(() => {
    return getBlockscoutApi(chainId);
  }, [chainId]);
};
