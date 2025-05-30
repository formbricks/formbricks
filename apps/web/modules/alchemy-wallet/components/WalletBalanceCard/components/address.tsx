"use client";

import IconButton from "@/modules/alchemy-wallet/components/common/icon-button";
import { useTranslate } from "@tolgee/react";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatAddress } from "@formbricks/web3";
import { useConfig } from "@formbricks/web3/src/hooks/useConfig";

type Props = {
  address: string;
};

export function Address({ address }: Props) {
  const { t } = useTranslate();
  const { config } = useConfig();
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
          className="text-primary hover:text-primary-50 inline-flex h-8 w-8"
          label={t("environments.wallet.address.copy.button")}
          icon={CopyIcon}
          onClick={handleCopyAddress}
        />
        <Link
          href={`${config.URLS.EXPLORER}/address/${address}`}
          target="_blank"
          className="inline-flex h-8 w-8 items-center justify-center">
          <IconButton
            className="text-primary hover:text-primary-50"
            label={t("environments.wallet.address.copy.button")}
            icon={ExternalLinkIcon}
          />
        </Link>
      </>
    </div>
  );
}

export default Address;
