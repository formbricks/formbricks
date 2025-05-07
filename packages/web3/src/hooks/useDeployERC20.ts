import { useSigner } from "@account-kit/react";
import { getFactory, sendTransaction } from "@wonderchain/sdk";
import { parseEther } from "ethers";
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
        parseEther(initialSupply),
        address
      );
      input.from = address;
      input.value = input.value || BigInt(0);

      const resp = await sendTransaction(provider, input, signer.signTypedData);
      if (!resp.hash) return;

      // console.log("useDeployERC20 resp", resp);
      const receipt = await provider.waitForTransaction(resp.hash);

      //https://ethereum.stackexchange.com/questions/26640/find-topic0-topic1-topic2
      const TRANSFER_EVENT_SIGNATURE = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

      // console.log("receipt", receipt);
      let tokenAddress = "";
      if (
        receipt &&
        receipt.logs &&
        receipt.logs[1] &&
        receipt.logs[1].topics &&
        receipt.logs[1].topics[0] == TRANSFER_EVENT_SIGNATURE
      ) {
        tokenAddress = receipt.logs[1].address;
      }
      // console.log("tokenAddress", tokenAddress);
      return {
        transactionHash: resp,
        tokenAddress: tokenAddress,
      };
    },
    [signer, provider]
  );

  return { deploy };
};
