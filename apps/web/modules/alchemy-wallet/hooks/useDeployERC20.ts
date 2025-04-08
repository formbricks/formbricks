import { useSigner } from "@account-kit/react";
import { addPaymasterData, addSignatureAndSerialize, getFactory, txToTypedData } from "@wonderchain/sdk";
import { useCallback } from "react";
import { useProvider } from "./useProvider";

export const useDeployERC20 = () => {
  const signer = useSigner();
  const { provider } = useProvider();

  const deploy = useCallback(async () => {
    if (!signer) return;

    const address = await signer.getAddress();

    // using faucet (testnet only)
    const factory = await getFactory(provider);
    const input = await factory.deployERC20.populateTransaction("Token", "TKN", "10000000000000000000000");

    const tx = await addPaymasterData(provider, {
      from: address,
      to: await factory.getAddress(),
      value: input.value?.toLocaleString() || "0",
      data: input.data,
    });

    const signature = await signer.signTypedData(await txToTypedData(provider, tx));

    const signedTx = await addSignatureAndSerialize(tx, signature);

    const resp = await provider.broadcastTransaction(signedTx);
    console.log(resp);
  }, [signer, provider]);

  return { deploy };
};
