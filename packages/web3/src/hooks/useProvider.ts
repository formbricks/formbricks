import { CONFIG } from "@wonderchain/sdk";
import { useMemo } from "react";
import { Provider } from "zksync-ethers";
import { useChainId } from "./useChainId";

export const useProvider = () => {
  const chainId = useChainId();
  const provider = useMemo(() => {
    return new Provider(CONFIG[chainId].URLS.RPC);
  }, [chainId]);
  return { provider };
};
