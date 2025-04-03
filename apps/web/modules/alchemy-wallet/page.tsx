import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import WalletButton from "@/modules/alchemy-wallet/components/wallet-button";
import WalletBalanceCard from "@/modules/alchemy-wallet/components/wallet-balance-card";

export const AlchemyWalletPage = async () => {
  const t = await getTranslate();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.wallet")}/>
      <div>
        <WalletBalanceCard/>
        <WalletButton/>
      </div>
    </PageContentWrapper>
  );
};
