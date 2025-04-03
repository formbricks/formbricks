"use client";

import React from "react";
import { useSmartAccountClient } from "@account-kit/react";
import { formatAddress } from "@/modules/alchemy-wallet/lib/utils/format";
import { CopyIcon } from "lucide-react";
import IconButton from "@/modules/alchemy-wallet/components/common/IconButton";
import toast from "react-hot-toast";
import { useTranslate } from "@tolgee/react";

export function WalletAddress(): React.JSX.Element {
  const { address } = useSmartAccountClient({});
  const { t } = useTranslate();
  const handleCopyAddress = () => {
    if (!address){
      toast.error(t("environment.wallet.address.copy_error"));
      return;
    }
    navigator.clipboard.writeText(address).then(() => {
      toast.success(t("environment.wallet.address.copy_success"));
    })
  }

  return (
    <div className="flex flex-row items-center gap-2">
      {address ? 
        <>
          <span>
            {formatAddress(address)}
          </span>
          <IconButton label={t("environment.wallet.address.copy_button")} icon={CopyIcon} onClick={handleCopyAddress}/>
        </>
        :
        <span>
          {formatAddress("0x00000000",3)}
        </span>
      }
    </div>
  );
}

export default WalletAddress;
