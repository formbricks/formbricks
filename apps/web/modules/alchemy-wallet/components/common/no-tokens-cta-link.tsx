"use client";

import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import React from "react";
import { cn } from "@formbricks/lib/cn";

interface Props {
  className?: string;
}

export function NoTokensCTALink({ className }: Props): React.JSX.Element {
  const { t } = useTranslate();

  return (
    <Link
      aria-label={t("common.mint_tokens")}
      href={"https://app.engagehq.xyz/s/cm9sr6au60006t9010yzp17m7"}
      target="_blank"
      className={cn("p-2 text-sm no-underline", className)}>
      {t("common.mint_your_own_tokens")}
    </Link>
  );
}

export default NoTokensCTALink;
