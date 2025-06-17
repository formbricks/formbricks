"use client";

import TransactionHistory from "@/modules/alchemy-wallet/components/TransactionHistory";
import WalletBalanceCard from "@/modules/alchemy-wallet/components/WalletBalanceCard";
import WalletTokenBalances from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-token-balances";
import { WalletPageHeader } from "@/modules/alchemy-wallet/components/wallet-page-header";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { useUser } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import { TokenBalance } from "@wonderchain/sdk/dist/blockscout-client";
import { useEffect, useState } from "react";
import { useBlockscoutApi } from "@formbricks/web3";
import { Button } from "../ui/components/button";
import { WalletModal } from "./components/WalletBalanceCard/components/wallet-modal";

export const AlchemyWalletPage = () => {
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const user = useUser();
  const address = user?.address || "";
  const blockscoutApi = useBlockscoutApi();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const handleMintToken = () => {
    window.open("https://app.engagehq.xyz/s/cm9sr6au60006t9010yzp17m7", "_blank");
  };
  const { t } = useTranslate();

  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !blockscoutApi) return;
      const data = await blockscoutApi.getAddressTokenBalances(address);
      setBalances(data.data);
    };

    fetchBalances();

    const interval = setInterval(fetchBalances, 60000);
    return () => clearInterval(interval);
  }, [blockscoutApi, address]);
  return (
    <PageContentWrapper>
      <WalletPageHeader user={user} />
      <WalletBalanceCard tokenCount={balances?.length || 0} />
      <div>
        <div className="flex justify-center gap-2 px-4 md:hidden">
          <Button
            variant="outline"
            size="lg"
            className="text-tertiary hover:bg-primary/10 w-full rounded-lg border-2 border-[#51D6FF]"
            onClick={handleMintToken}>
            {t("common.mint_token")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="text-tertiary hover:bg-primary/10 w-full rounded-lg border-2 border-[#51D6FF]"
            onClick={() => setShowWalletModal(true)}>
            {t("common.deposit")}
          </Button>
        </div>

        <WalletModal address={address} open={showWalletModal} setOpen={setShowWalletModal} />
      </div>

      <WalletTokenBalances balances={balances} setBalances={setBalances} />
      <TransactionHistory />
    </PageContentWrapper>
  );
};
