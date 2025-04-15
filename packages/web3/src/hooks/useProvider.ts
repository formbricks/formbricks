import { useMemo } from "react";
import { Provider } from "zksync-ethers";
import { useConfig } from "./useConfig";

export const useProvider = () => {
  const { config } = useConfig();
  const provider = useMemo(() => {
    return new Provider(config.URLS.RPC);
  }, [config]);
  return { provider };
};
