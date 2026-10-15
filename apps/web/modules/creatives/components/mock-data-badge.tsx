"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

/** Marks every Creatives page as a prototype: nothing here reads or writes real data. */
export const MockDataBadge = () => {
  const { t } = useTranslation();
  return (
    <TooltipRenderer tooltipContent={t("workspace.creatives.mock_data_tooltip")} triggerClass="inline-flex">
      <Badge text={t("workspace.creatives.mock_data")} type="warning" size="normal" />
    </TooltipRenderer>
  );
};
