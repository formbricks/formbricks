import TransactionHistory from "@/modules/alchemy-wallet/components/TransactionHistory";
import WalletBalanceCard from "@/modules/alchemy-wallet/components/WalletBalanceCard";
import WalletTokenBalances from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-token-balances";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";

export const AlchemyWalletPage = async () => {
  const t = await getTranslate();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.wallet")} hideBottomBorder />
      <WalletBalanceCard />
      <WalletTokenBalances />
      <TransactionHistory />
    </PageContentWrapper>
  );
};
