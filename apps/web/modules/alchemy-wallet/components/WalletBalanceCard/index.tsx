"use client";

import WalletAddress from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-address";
import WalletEthBalance from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-eth-balance";
import { useTranslate } from "@tolgee/react";
import { cn } from "@formbricks/lib/cn";
import WalletTokens from "./components/wallet-tokens";

interface WalletBalanceCardProps {
  tokenCount?: number;
  className?: string;
}

export function WalletBalanceCard({ tokenCount = 0, className = "" }: WalletBalanceCardProps) {
  const { t } = useTranslate();

  return (
    <div
      className={cn("relative my-4 flex w-full flex-col gap-4 px-4 py-4 md:flex-row", className)}
      id={"wallet-balance"}>
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {/* Wallet Address */}
        <WalletInfoContainer>
          <div className="text-primary text-3xl font-bold">
            <WalletAddress />
          </div>
          <div className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
              {t("environments.wallet.balance_card.wallet_address")}
            </h3>
          </div>
        </WalletInfoContainer>
        {/* Eth Balance */}
        <WalletInfoContainer>
          <WalletEthBalance />
          <div className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
              {t("environments.wallet.balance_card.balance")}
            </h3>
          </div>
        </WalletInfoContainer>
        {/* Token Types */}
        <WalletInfoContainer>
          <WalletTokens tokenCount={tokenCount} />
          <div className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-medium leading-6 text-slate-900">
              {t("environments.wallet.balance_card.token_types_owned")}
            </h3>
          </div>
        </WalletInfoContainer>
      </div>
    </div>
  );
}

export default WalletBalanceCard;

interface WalletInfoContainerProps {
  className?: string;
  children: React.ReactNode;
}

function WalletInfoContainer({ className = "", children }: WalletInfoContainerProps) {
  return (
    <div
      className={cn(
        "bg-primary-20 flex min-h-[187px] flex-col items-center justify-center gap-2 rounded-2xl",
        className
      )}>
      {children}
    </div>
  );
}
