import { useSigner } from "@account-kit/react";
import { sendTransaction } from "@wonderchain/sdk";
import { parseUnits } from "ethers";
import { useCallback } from "react";
import { useERC20 } from "./useERC20";
import { useProvider } from "./useProvider";

type Props = {
  address: string;
};

export const useSendERC20 = ({ address }: Props) => {
  const signer = useSigner();
  const { provider } = useProvider();
  const { token } = useERC20({ address });

  const send = useCallback(
    async (to: string, quantity: number) => {
      if (!signer || !token) return;
      const address = await signer.getAddress();
      const decimals = await token.decimals();
      const input = await token.transfer.populateTransaction(
        to,
        parseUnits(quantity.toString(), parseInt(decimals.toString(), 10))
      );

      input.from = address;
      input.value = input.value || BigInt(0);

      const resp = await sendTransaction(provider, input, signer.signTypedData);
      console.log(resp);
      return resp;
    },
    [signer, token]
  );

  return { send };
};
