"use client";

import { useTranslate } from "@tolgee/react";
import { SmartphoneIcon, XIcon } from "lucide-react";

export const NoMobileOverlay = () => {
  const { t } = useTranslate();
  return (
    <>
      <div className="fixed inset-0 z-9999 flex items-center justify-center sm:hidden">
        <div className="relative h-full w-full bg-slate-50"></div>
        <div className="bg-slate-850 absolute mx-8 flex flex-col items-center gap-6 rounded-lg px-8 py-10 text-center">
          <XIcon className="absolute top-14 h-8 w-8 text-slate-500" />
          <SmartphoneIcon className="h-16 w-16 text-slate-500" />
          <p className="text-slate-500">{t("common.mobile_overlay_text")}</p>
        </div>
      </div>
    </>
  );
};
