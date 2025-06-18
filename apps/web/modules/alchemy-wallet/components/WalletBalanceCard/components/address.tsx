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
  variant?: "default" | "small";
};

export function Address({ address, variant = "default" }: Props) {
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

  const iconSize = variant == "default" ? "lg" : "sm";

  if (!address) {
    return;
  }

  return (
    <div className="flex flex-row items-center md:gap-2">
      <>
        <span>{formatAddress(address)}</span>
        <div className={`flex flex-row items-center ${variant == "default" ? "" : "-space-x-2"}`}>
          <IconButton
            className="text-primary hover:text-primary-50 -mr-3 inline-flex h-8 w-8 md:mr-0"
            label={t("environments.wallet.address.copy.button")}
            icon={CopyIcon}
            onClick={handleCopyAddress}
            iconSize={iconSize}
          />
          <Link
            href={`${config.URLS.EXPLORER}/address/${address}`}
            target="_blank"
            className="-mr-2 inline-flex h-8 w-8 items-center justify-center md:mr-0">
            <IconButton
              className="text-primary hover:text-primary-50"
              label={t("environments.wallet.address.copy.button")}
              icon={ExternalLinkIcon}
              iconSize={iconSize}
            />
          </Link>
        </div>
      </>
    </div>
  );
}

export default Address;
