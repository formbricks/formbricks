"use client";

import { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface ClickableBarSegmentProps {
  children: ReactNode;
  onClick: () => void;
  className?: string;
  style?: CSSProperties;
}

export const ClickableBarSegment = ({
  children,
  onClick,
  className = "",
  style,
}: ClickableBarSegmentProps) => {
  const { t } = useTranslation();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className={className} style={style} onClick={onClick}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{t("common.click_to_filter")}</TooltipContent>
    </Tooltip>
  );
};
