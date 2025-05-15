"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { ArrowRightIcon } from "lucide-react";
import React from "react";
import { cn } from "@formbricks/lib/cn";

interface Props {
  className?: string;
}

export function NoTokensCTAButton({ className }: Props): React.JSX.Element {
  const { t } = useTranslate();

  return (
    <Button
      aria-label={t("common.mint_tokens")}
      onClick={() => window.open("https://app.engagehq.xyz/s/cm9sr6au60006t9010yzp17m7", "_blank")}
      className={cn(
        "ring-offset-background focus-visible:ring-ring group inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-xs transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 md:text-sm",
        className
      )}>
      {t("common.mint_now")}
      <ArrowRightIcon
        className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1 md:ml-2 md:h-4 md:w-4"
        strokeWidth={3}
      />
    </Button>
  );
}

export default NoTokensCTAButton;
