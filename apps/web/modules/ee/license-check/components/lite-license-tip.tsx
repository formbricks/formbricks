"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  type TLiteLicenseFeature,
  getLiteLicenseRequestUrl,
} from "@/modules/ee/license-check/lib/lite-license";
import { Button } from "@/modules/ui/components/button";

interface LiteLicenseTipProps {
  feature: TLiteLicenseFeature;
  title: string;
  description: string;
  layout?: "centered" | "inline";
}

export const LiteLicenseTip = ({
  feature,
  title,
  description,
  layout = "centered",
}: Readonly<LiteLicenseTipProps>) => {
  const { t } = useTranslation();
  const isInline = layout === "inline";

  const handleClick = () => {
    if (posthog.__loaded) {
      posthog.capture("lite_license_cta_clicked", { feature });
    }
  };

  return (
    <div
      className={cn(
        "flex w-full",
        isInline
          ? "flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
          : "flex-col items-center gap-5 px-6 py-8"
      )}>
      <div className="w-fit rounded-md border border-slate-200 bg-white p-3">
        <SparklesIcon className="size-6 text-teal-600" />
      </div>
      <div
        className={cn(
          "flex flex-col gap-1",
          isInline ? "grow" : "max-w-[80%] items-center gap-2 text-center"
        )}>
        <h2 className={cn("font-semibold text-slate-900", isInline ? "text-sm" : "text-xl")}>{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <Button asChild size={isInline ? "sm" : "default"} className="w-fit shrink-0">
        <Link
          href={getLiteLicenseRequestUrl(feature)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          referrerPolicy="no-referrer"
          onClick={handleClick}>
          {t("common.request_lite_license")}
        </Link>
      </Button>
    </div>
  );
};
