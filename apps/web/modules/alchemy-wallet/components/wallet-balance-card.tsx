"use client";

import React from "react";
import { useTranslate } from "@tolgee/react";
import { cn } from "@formbricks/lib/cn";
import WalletAddress from "@/modules/alchemy-wallet/components/wallet-address";
import WalletBalance from "@/modules/alchemy-wallet/components/wallet-balance";

export function WalletBalanceCard({className=""}:{
  className?: string;
}): React.JSX.Element {
  const { t } = useTranslate();

  return (
    <div
    className={cn(
      "relative my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 text-left shadow-sm",
      className
    )}
    id={"wallet-balance"}>
    <div className="px-4 grid grid-cols-3 gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">Wallet Address</h3>
        <div className="bg-slate-400 p-2 rounded-md">
          <WalletAddress/>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">Balance</h3>
        <div className="text-xl font-bold rounded-md">
          <WalletBalance/>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">Pending Rewards</h3>
        <div className="text-xl font-bold rounded-md">
          0 Wei
        </div>
      </div>
    </div>
  </div>
  );
}

export default WalletBalanceCard;
