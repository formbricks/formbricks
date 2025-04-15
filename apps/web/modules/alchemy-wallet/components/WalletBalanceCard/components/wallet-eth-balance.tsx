"use client";

import { useSmartAccountClient } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import IconButton from "../../common/icon-button";

interface Props {}

export function WalletEthBalance({}: Props): React.JSX.Element {
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const { client, address } = useSmartAccountClient({});
  const [balance, setBalance] = useState<bigint>();
  const { t } = useTranslate();

  // Fetch balance when client and address loaded
  useEffect(() => {
    if (!client || !address) {
      return;
    }

    const fetchBalance = async () => {
      const balanceData = await client.getBalance({
        address: address,
      });
      setBalance(balanceData);
    };

    fetchBalance();
  }, [client, address]);

  return (
    <div className="flex items-center">
      <p className="text-2xl font-bold">
        {showBalance
          ? balance != undefined
            ? `${balance} ETH`
            : t("environments.wallet.balance_card.balance_unavailable")
          : "••••••"}
      </p>
      <IconButton
        className="text-black hover:text-black"
        icon={!showBalance ? EyeIcon : EyeOffIcon}
        onClick={() => setShowBalance((prev) => !prev)}
        label={t("environments.wallet.balance_card.external_link")}
      />
    </div>
  );
}

export default WalletEthBalance;
