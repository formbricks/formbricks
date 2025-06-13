import TransactionHistory from "@/modules/alchemy-wallet/components/TransactionHistory";
import WalletBalanceCard from "@/modules/alchemy-wallet/components/WalletBalanceCard";
import WalletTokenBalances from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-token-balances";
import { WalletPageHeader } from "@/modules/alchemy-wallet/components/wallet-page-header";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";

export const AlchemyWalletPage = async () => {
  return (
    <PageContentWrapper>
      <WalletPageHeader />
      <WalletBalanceCard />
      <WalletTokenBalances />
      <TransactionHistory />
    </PageContentWrapper>
  );
};
