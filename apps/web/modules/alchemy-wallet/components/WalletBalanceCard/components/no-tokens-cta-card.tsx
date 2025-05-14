"use client";

import NoTokensCTAButton from "@/modules/alchemy-wallet/components/common/no-tokens-cta-button";
import { useTranslate } from "@tolgee/react";
import React, { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";

export function NoTokensCTACard(): React.JSX.Element {
  const { t } = useTranslate();
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);

  useEffect(() => {
    const checkNavState = () => {
      const mainNavCollapseStatus = localStorage.getItem("isMainNavCollapsed");
      setIsNavCollapsed(mainNavCollapseStatus == "true");
    };

    checkNavState();

    const handleNavCollapseChange = (e: StorageEvent) => {
      if (e.key == "isMainNavCollapsed") {
        setIsNavCollapsed(e.newValue == "true");
      }
    };

    window.addEventListener("storage", handleNavCollapseChange);

    const navStateCheckInterval = setInterval(checkNavState, 500);

    return () => {
      clearInterval(navStateCheckInterval);
      window.removeEventListener("storage", handleNavCollapseChange);
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed bottom-4 z-10 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-md md:p-4",
        "w-[80%] md:w-full md:max-w-md",
        //based on sidebar style in tailwind.config.js
        isNavCollapsed ? "left-[calc(50%+2rem)]" : "left-[calc(50%+7rem)]"
      )}>
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-medium text-slate-900 md:text-base">
            {t("common.interested_in_minting")}
          </h3>
          <p className="text-xs text-slate-600 md:text-sm">{t("common.find_out_more_and_mint")}</p>
        </div>
        <NoTokensCTAButton />
      </div>
    </div>
  );
}

export default NoTokensCTACard;
