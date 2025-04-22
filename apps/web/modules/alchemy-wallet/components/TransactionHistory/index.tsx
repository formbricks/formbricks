"use client";

import TransactionItem from "@/modules/alchemy-wallet/components/TransactionHistory/components/transaction-item";
import { useUser } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import { TokenTransfer } from "@wonderchain/sdk/dist/blockscout-client";
import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { useBlockscoutApi } from "@formbricks/web3";

export function TransactionHistory({ className = "" }: { className?: string }) {
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

  if (!transfers?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white py-4 shadow-sm",
        className
      )}
      id={"transaction-history"}>
      <h3 className="px-4 text-lg font-medium capitalize leading-6 text-slate-900">
        {t("common.transaction_history")}
      </h3>
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
    </div>
  );
}

export default TransactionHistory;
