import { Erc20, getERC20 } from "@wonderchain/sdk";
import { useEffect, useState } from "react";
import { useProvider } from "./useProvider";

type Props = {
  address: string;
};
export const useERC20 = ({ address }: Props) => {
  const { provider } = useProvider();
  const [token, setToken] = useState<Erc20 | null>(null);

  useEffect(() => {
    (async () => {
      if (!address || !provider) {
        setToken(null);
        return;
      }
      const token = await getERC20(provider, address);
      setToken(token);
    })();
  }, [address, provider]);

  return { token };
};
