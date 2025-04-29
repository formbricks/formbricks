"use client";

import NoTokensCTAButton from "@/modules/alchemy-wallet/components/common/no-tokens-cta-button";
import { useTranslate } from "@tolgee/react";
import React from "react";

export function NoTokensCTACard(): React.JSX.Element {
  const { t } = useTranslate();

  return (
    <div className="ml-223 fixed bottom-4 z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 text-left shadow-md md:ml-[200px] md:translate-x-1/2">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-medium text-slate-900">{t("common.interested_in_minting")}</h3>
          <p className="text-sm text-slate-600">{t("common.find_out_more_and_mint")}</p>
        </div>
        <NoTokensCTAButton />
      </div>
    </div>
  );
}

export default NoTokensCTACard;
