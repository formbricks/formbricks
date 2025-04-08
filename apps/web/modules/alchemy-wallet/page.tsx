import WalletBalanceCard from "@/modules/alchemy-wallet/components/WalletBalanceCard";
import TransactionHistory from "@/modules/alchemy-wallet/components/TransactionHistory";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";

export const AlchemyWalletPage = async () => {
  const t = await getTranslate();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.wallet")} />
      <WalletBalanceCard />
      <TransactionHistory />
    </PageContentWrapper>
  );
};
