"use client";

import React, { useEffect, useState } from "react";
import { useSmartAccountClient } from "@account-kit/react";

export function WalletBalance(): React.JSX.Element {
  const { client, address } = useSmartAccountClient({});
  const [balance, setBalance] = useState<bigint>();
  
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

  console.log(balance);
  return (
    <div className="flex">
      {balance != undefined ? 
        <span>
          {balance} Wei
        </span>
        :
        <span>
          Balance unavailable
        </span>
      }
    </div>
  );
}

export default WalletBalance;
