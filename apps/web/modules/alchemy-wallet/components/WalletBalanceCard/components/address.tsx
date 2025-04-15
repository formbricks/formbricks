"use client";

import IconButton from "@/modules/alchemy-wallet/components/common/icon-button";
import { useTranslate } from "@tolgee/react";
import { CopyIcon } from "lucide-react";
import toast from "react-hot-toast";
import { formatAddress } from "@formbricks/web3";

type Props = {
  address: string;
};

export function Address({ address }: Props) {
  const { t } = useTranslate();
  const handleCopyAddress = () => {
    if (!address) {
      toast.error(t("environments.wallet.address.copy.error"));
      return;
    }
    navigator.clipboard.writeText(address).then(() => {
      toast.success(t("environments.wallet.address.copy.success"));
    });
  };

  if (!address) {
    return;
  }

  return (
    <div className="flex flex-row items-center gap-2">
      <>
        <span>{formatAddress(address)}</span>
        <IconButton
          label={t("environments.wallet.address.copy.button")}
          icon={CopyIcon}
          onClick={handleCopyAddress}
        />
      </>
    </div>
  );
}

export default Address;
