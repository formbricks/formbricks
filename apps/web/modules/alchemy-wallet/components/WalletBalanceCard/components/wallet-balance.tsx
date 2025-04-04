"use client";

import React, { useEffect, useState } from "react";
import { useSmartAccountClient } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";

interface WalletBalanceProps {
  showBalance?: boolean;
}

export function WalletBalance({showBalance=true}:WalletBalanceProps): React.JSX.Element {
  const { client, address } = useSmartAccountClient({});
  const [balance, setBalance] = useState<bigint>();
  const { t } = useTranslate()

  // Fetch balance when client and address loaded
  useEffect(() => {
    if(!client || !address){
      return;
    }

    const fetchBalance = async () => {
      const balanceData = await client.getBalance({
        address: address
      });
      setBalance(balanceData);
    }

    fetchBalance();
  },[client, address])

  return (
    <div className="flex">
      <p className="text-2xl font-bold">
        {
         showBalance ? 
          balance != undefined ? `${balance} Wei` : t("environments.wallet.balance_card.balance_unavailable")
          : "••••••"
        }
      </p>
    </div>
  );
}

export default WalletBalance;
