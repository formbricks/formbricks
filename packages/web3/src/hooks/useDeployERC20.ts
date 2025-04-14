import { useSigner } from "@account-kit/react";
import { getFactory, sendTransaction } from "@wonderchain/sdk";
import { useCallback } from "react";
import { useProvider } from "./useProvider";

export const useDeployERC20 = () => {
  const signer = useSigner();
  const { provider } = useProvider();

  const deploy = useCallback(
    async (tokenName: string, tokenSymbol: string, initialSupply: string) => {
      if (!signer) return;
      const address = await signer.getAddress();
      const factory = await getFactory(provider);
      const input = await factory.deployERC20.populateTransaction(
        tokenName,
        tokenSymbol,
        initialSupply,
        address
      );
      input.from = address;
      input.value = input.value || BigInt(0);
      
      const resp = await sendTransaction(provider, input, signer.signTypedData);
      console.log(resp);
      return resp;
    },
    [signer, provider]
  );

  return { deploy };
};
