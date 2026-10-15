"use client";

import { FlaskConicalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

/** Marks every Creatives page as a prototype: nothing here reads or writes real data. */
export const MockDataBadge = () => {
  const { t } = useTranslation();
  return (
    <TooltipRenderer tooltipContent={t("workspace.creatives.mock_data_tooltip")} triggerClass="inline-flex">
      <span className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-dashed border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
        <FlaskConicalIcon className="size-3.5" aria-hidden="true" />
        {t("workspace.creatives.mock_data")}
      </span>
    </TooltipRenderer>
  );
};
