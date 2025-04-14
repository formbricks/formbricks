"use client";

// import React, { useState } from "react";
// import { useTranslate } from "@tolgee/react";
// import { useSmartAccountClient } from "@account-kit/react";
import TransactionItem from "@/modules/alchemy-wallet/components/TransactionHistory/components/transaction-item";
import { Transaction } from "@/modules/alchemy-wallet/components/TransactionHistory/components/transaction-item";
import { useUser } from "@account-kit/react";
import { TokenTransfer } from "@wonderchain/sdk/dist/blockscout-client";
import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { useBlockscoutApi } from "@formbricks/web3";

export function TransactionHistory({ className = "" }: { className?: string }) {
  const user = useUser();
  const address = user?.address || "";
  const blockscoutApi = useBlockscoutApi();
  const [transfers, setTransfers] = useState<TokenTransfer[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const filterTransfersByERC20AndERC1155Totals = (transfers: TokenTransfer[]) => {
    return transfers.filter((t): t is Transaction => {
      const total = t.total;

      const isERC20 = "decimals" in total && "value" in total && !("token_id" in total);

      const isERC1155 = "token_id" in total && "value" in total && "decimals" in total;

      return isERC20 || isERC1155;
    });
  };

  useEffect(() => {
    (async () => {
      if (!address || !blockscoutApi) return;
      const data = await blockscoutApi.getAddressTokenTransfers(address);
      setTransfers(data.data.items);
    })();
  }, [blockscoutApi, address]);

  useEffect(() => {
    if (!transfers) {
      return;
    }
    setTransactions(filterTransfersByERC20AndERC1155Totals(transfers));
  }, [transfers]);

  if (!transactions?.length) {
    return null;
  }
  return (
    <div
      className={cn(
        "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
        className
      )}
      id={"transaction-history"}>
      {transactions.map((t) => (
        <TransactionItem transaction={t} key={t.transaction_hash + t.token + t.type + t.from + t.to} />
      ))}
    </div>
  );
}

export default TransactionHistory;
