"use client";

import React, { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { cn } from "@formbricks/lib/cn";
import WalletAddress from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-address";
import WalletBalance from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-balance";
import IconButton from "@/modules/alchemy-wallet/components/common/IconButton";
import { EyeIcon, EyeOffIcon, SquareArrowOutUpRightIcon } from "lucide-react";
export function WalletBalanceCard({className=""}:{
  className?: string;
}): React.JSX.Element {
  const { t } = useTranslate();
  const [showBalance, setShowBalance] = useState(true);

  return (
    <div
      className={cn(
        "relative my-4 w-full rounded-xl border border-slate-200 bg-white py-4 text-left shadow-sm",
        className
      )}
      id={"wallet-balance"}
    >
      <div className="px-4 grid grid-cols-3 gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2 items-center justify-between">
            <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">{t("environments.wallet.balance_card.wallet_address")}</h3>
            <IconButton className="text-black hover:text-black" icon={SquareArrowOutUpRightIcon} onClick={() => console.log("External Link to ether scan")} label={t("environments.wallet.balance_card.external_link")}/>
          </div>
          <div className="bg-slate-400 p-2 rounded-md">
            <WalletAddress/>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2 items-center justify-between">
            <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">{t("environments.wallet.balance_card.balance")}</h3>
            <IconButton className="text-black hover:text-black" icon={!showBalance ? EyeIcon : EyeOffIcon} onClick={() => setShowBalance((prev) => !prev)} label={t("environments.wallet.balance_card.external_link")}/>
          </div>
          <WalletBalance showBalance={showBalance}/>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">{t("environments.wallet.balance_card.pending_rewards")}</h3>
          <div className="text-2xl font-bold">0 Wei</div>
        </div>
      </div>
    </div>
  );
}

export default WalletBalanceCard;
