"use client";

import NoTokensCTAButton from "@/modules/alchemy-wallet/components/common/no-tokens-cta-button";
import { useTranslate } from "@tolgee/react";
import React from "react";
import { cn } from "@formbricks/lib/cn";

interface Props {
  className?: string;
}

export function NoTokensCTACard({ className }: Props): React.JSX.Element {
  const { t } = useTranslate();

  return (
    <div
      className={cn(
        "my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm",
        className
      )}>
      <div>
        <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">{t("common.no_tokens")}</h3>
        <p className="">{t("common.click_the_button_below_to_start_minting")}</p>
      </div>
      <NoTokensCTAButton />
    </div>
  );
}

export default NoTokensCTACard;
