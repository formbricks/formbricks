"use client";

import React from "react";
import { useSmartAccountClient } from "@account-kit/react";
import { formatAddress } from "@/modules/alchemy-wallet/lib/utils/format";

export function WalletAddress(): React.JSX.Element {
  const { address } = useSmartAccountClient({});
  return (
    <div className="flex">
      {address ? 
        <span>
          {formatAddress(address)}
        </span>
        :
        <span>
          {formatAddress("0x00000000",3)}
        </span>
      }
    </div>
  );
}

export default WalletAddress;
