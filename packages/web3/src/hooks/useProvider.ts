import { useMemo } from "react";
import { Provider } from "zksync-ethers";

const rpcUrl = "https://rpc.testnet.wonderchain.org";

export const useProvider = () => {
  const provider = useMemo(() => {
    return new Provider(rpcUrl);
  }, []);
  return { provider };
};
