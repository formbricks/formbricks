"use client";

// import React, { useState } from "react";
// import { useTranslate } from "@tolgee/react";
import { cn } from "@formbricks/lib/cn";
// import { useSmartAccountClient } from "@account-kit/react";
import TransactionItem from "@/modules/alchemy-wallet/components/TransactionHistory/components/transaction-item";

export function TransactionHistory({className=""}:{
  className?: string;
}): React.JSX.Element {
  // const { t } = useTranslate();
  // const [showBalance, setShowBalance] = useState(true);
  // const { address } = useSmartAccountClient({});

  return (
    <div
      className={cn(
        "relative my-4 p-4 flex flex-col gap-4 w-full rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}
      id={"transaction-history"}
    >
      <TransactionItem />
      <TransactionItem />
      <TransactionItem />
      <TransactionItem />
    </div>
  );
}

export default TransactionHistory;