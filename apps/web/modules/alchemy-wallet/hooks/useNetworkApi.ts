import { Configuration, NetworkApi } from "@wonderchain/sdk";
import { useMemo } from "react";

const apiHost = "https://api.wonderchain.org";
export const useNetworkApi = () => {
  const networkApi = useMemo(() => {
    const config = new Configuration({
      basePath: apiHost,
    });
    return new NetworkApi(config);
  }, []);

  return { networkApi };
};
