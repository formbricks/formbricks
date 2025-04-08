"use client";

import IconButton from "@/modules/alchemy-wallet/components/common/IconButton";
import { formatAddress } from "@/modules/alchemy-wallet/lib/utils/format";
import { useUser } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import { CopyIcon } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";

export function WalletAddress(): React.JSX.Element {
  const user = useUser();
  const { t } = useTranslate();
  const handleCopyAddress = () => {
    if (!user?.address) {
      toast.error(t("environments.wallet.address.copy.error"));
      return;
    }
    navigator.clipboard.writeText(user.address).then(() => {
      toast.success(t("environments.wallet.address.copy.success"));
    });
  };

  return (
    <div className="flex flex-row items-center gap-2">
      {user?.address ? (
        <>
          <span>{formatAddress(user.address)}</span>
          <IconButton
            label={t("environments.wallet.address.copy.button")}
            icon={CopyIcon}
            onClick={handleCopyAddress}
          />
        </>
      ) : (
        <span>{formatAddress("0x00000000", 3)}</span>
      )}
    </div>
  );
}

export default WalletAddress;
