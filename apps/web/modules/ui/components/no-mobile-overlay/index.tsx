"use client";

import { useTranslate } from "@tolgee/react";
import { ExternalLinkIcon, Maximize2Icon, SmartphoneIcon } from "lucide-react";
import { Button } from "@/modules/ui/components/button";

export const NoMobileOverlay = () => {
  const { t } = useTranslate();
  return (
    <div className="fixed inset-0 z-[9999] sm:hidden">
      <div className="absolute inset-0 bg-slate-50"></div>
      <div className="relative mx-auto flex h-full max-w-xl flex-col items-center justify-center py-16 text-center">
        <div className="relative h-16 w-16">
          <SmartphoneIcon className="text-muted-foreground h-16 w-16" />
          <Maximize2Icon className="text-muted-foreground absolute left-1/2 top-1/3 h-5 w-5 -translate-x-1/2 -translate-y-1/3" />
        </div>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
          {t("common.mobile_overlay_title")}
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
          {t("common.mobile_overlay_app_works_best_on_desktop")}
        </p>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
          {t("common.mobile_overlay_surveys_look_good")}
        </p>
        <Button variant="default" asChild className="mt-8">
          <a href="https://formbricks.com/docs/xm-and-surveys/overview">
            {t("common.learn_more")}
            <ExternalLinkIcon />
          </a>
        </Button>
      </div>
    </div>
  );
};
