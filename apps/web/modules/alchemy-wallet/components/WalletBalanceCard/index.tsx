"use client";

import WalletAddress from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-address";
import WalletBalance from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-balance";
import IconButton from "@/modules/alchemy-wallet/components/common/IconButton";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { EyeIcon, EyeOffIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import React, { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { useDeployERC20 } from "../../hooks/useDeployERC20";
import SendModal from "@/modules/alchemy-wallet/components/common/SendModal";
import { useSmartAccountClient } from "@account-kit/react";

export function WalletBalanceCard({ className = "" }: { className?: string }): React.JSX.Element {
  const { t } = useTranslate();
  const [showBalance, setShowBalance] = useState(true);
  const { deploy } = useDeployERC20();
  const { address } = useSmartAccountClient({});

  return (
    <div
      className={cn(
        "relative my-4 px-4 flex flex-col md:flex-row gap-4 w-full rounded-xl border border-slate-200 bg-white py-4 text-left shadow-sm",
        className
      )}
      id={"wallet-balance"}
    >
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2 items-center justify-between">
            <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">{t("environments.wallet.balance_card.wallet_address")}</h3>
            <IconButton className="text-black hover:text-black" icon={SquareArrowOutUpRightIcon} label={t("environments.wallet.balance_card.external_link")} onClick={() => window.location.href = `https://etherscan.io/address/${address}`}/>
          </div>
          <div className="bg-secondary p-2 rounded-md text-secondary-foreground ">
            <WalletAddress/>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-row items-center justify-between gap-2">
            <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
              {t("environments.wallet.balance_card.balance")}
            </h3>
            <IconButton
              className="text-black hover:text-black"
              icon={!showBalance ? EyeIcon : EyeOffIcon}
              onClick={() => setShowBalance((prev) => !prev)}
              label={t("environments.wallet.balance_card.external_link")}
            />
          </div>
          <WalletBalance showBalance={showBalance} />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
            {t("environments.wallet.balance_card.pending_rewards")}
          </h3>
          <div className="text-2xl font-bold">0 Wei</div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <SendModal />
        <Button variant="secondary" onClick={() => console.log("Claim")} className="">{t("common.claim")}</Button>
      </div>

      <Button onClick={deploy}>Deploy</Button>
    </div>
  );
}

export default WalletBalanceCard;
