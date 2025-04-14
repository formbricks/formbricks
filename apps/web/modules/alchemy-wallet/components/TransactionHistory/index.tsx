"use client";

// import React, { useState } from "react";
// import { useTranslate } from "@tolgee/react";
// import { useSmartAccountClient } from "@account-kit/react";
import TransactionItem from "@/modules/alchemy-wallet/components/TransactionHistory/components/transaction-item";
import { useUser } from "@account-kit/react";
import { TokenTransfer } from "@wonderchain/sdk/dist/blockscout-client";
import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { useBlockscoutApi } from "@formbricks/web3";

export function TransactionHistory({ className = "" }: { className?: string }) {
  const user = useUser();
  const address = user?.address || "";
  // const { t } = useTranslate();
  // const [showBalance, setShowBalance] = useState(true);
  // const { address } = useSmartAccountClient({});
  const blockscoutApi = useBlockscoutApi();
  const [transfers, setTransfers] = useState<TokenTransfer[] | null>(null);

  useEffect(() => {
    (async () => {
      if (!address || !blockscoutApi) return;
      const data = await blockscoutApi.getAddressTokenTransfers(address);
      setTransfers(data.data.items);
    })();
  }, [blockscoutApi, address]);

  if (!transfers?.length) {
    return null;
  }
  return (
    <div
      className={cn(
        "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
        className
      )}
      id={"transaction-history"}>
      {transfers.map((t) => (
        <TransactionItem transfer={t} key={t.transaction_hash + t.token + t.type + t.from + t.to} />
      ))}
    </div>
  );
}

export default TransactionHistory;
