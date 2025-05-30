"use client";

import TransactionItem from "@/modules/alchemy-wallet/components/TransactionHistory/components/transaction-item";
import TransactionItemSkeleton from "@/modules/alchemy-wallet/components/TransactionHistory/components/transaction-item-skeleton";
import { useUser } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import { TokenTransfer } from "@wonderchain/sdk/dist/blockscout-client";
import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { useBlockscoutApi } from "@formbricks/web3";

export function TransactionHistory() {
  const user = useUser();
  const address = user?.address || "";
  const blockscoutApi = useBlockscoutApi();
  const [transfers, setTransfers] = useState<TokenTransfer[] | null>(null);
  const { t } = useTranslate();

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!address || !blockscoutApi) return;
      const data = await blockscoutApi.getAddressTokenTransfers(address);
      setTransfers(data.data.items);
    };

    fetchTransactions();

    let interval = setInterval(fetchTransactions, 60000);
    return () => clearInterval(interval);
  }, [blockscoutApi, address]);

  if (transfers == null) {
    return (
      <TransactionCardContainer title={t("common.transaction_history")}>
        <div className="flex max-h-96 flex-col gap-4 overflow-y-scroll px-4">
          <TransactionItemSkeleton />
          <TransactionItemSkeleton />
          <TransactionItemSkeleton />
        </div>
      </TransactionCardContainer>
    );
  }

  if (transfers.length === 0) {
    return (
      <TransactionCardContainer
        title={t("common.transaction_history")}
        className={"min-h-[200px] justify-center"}>
        <div className="col-span-3 flex w-full flex-col gap-1">
          <p className="text-center text-sm">
            {t("environments.wallet.transaction.common.no_transactions_yet")}
          </p>
        </div>
      </TransactionCardContainer>
    );
  }

  return (
    <TransactionCardContainer title={t("common.transaction_history")}>
      <div className="flex max-h-96 flex-col gap-4 overflow-y-scroll px-4">
        {transfers.map((t) => (
          <TransactionItem
            isToSelf={t.to.hash === address}
            isFromSelf={t.from.hash === address}
            transfer={t}
            key={t.transaction_hash + t.token + t.type + t.from + t.to}
          />
        ))}
      </div>
    </TransactionCardContainer>
  );
}

export default TransactionHistory;

interface TransactionCardContainerProps {
  title: string;
  className?: string;
  children: React.ReactNode;
}

export function TransactionCardContainer({ title, className = "", children }: TransactionCardContainerProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div
        className={cn(
          "shadow-card-20 relative my-5 flex w-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left",
          className
        )}
        id="transaction-history">
        {children}
      </div>
    </div>
  );
}
