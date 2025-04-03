"use client";

import WalletAddress from "@/modules/alchemy-wallet/components/wallet-address";
import WalletBalance from "@/modules/alchemy-wallet/components/wallet-balance";
import React from "react";
import { cn } from "@formbricks/lib/cn";

export function WalletBalanceCard({ className = "" }: { className?: string }): React.JSX.Element {
  return (
    <div
      className={cn(
        "relative my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 text-left shadow-sm",
        className
      )}
      id={"wallet-balance"}>
      <div className="grid grid-cols-3 gap-6 px-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">Wallet Address</h3>
          <div className="rounded-md bg-slate-400 p-2">
            <WalletAddress />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">Balance</h3>
          <div className="rounded-md text-xl font-bold">
            <WalletBalance />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">Pending Rewards</h3>
          <div className="rounded-md text-xl font-bold">0 Wei</div>
        </div>
      </div>
    </div>
  );
}

export default WalletBalanceCard;
