"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Input } from "@/modules/ui/components/input";
import type { TPlaceholderWorkflowAction } from "../lib/placeholder-data";

interface WorkflowDetailsPanelProps {
  action: TPlaceholderWorkflowAction;
  isVisible: boolean;
}

export const WorkflowDetailsPanel = ({ action, isVisible }: Readonly<WorkflowDetailsPanelProps>) => {
  const { t } = useTranslation();

  return (
    <aside
      aria-hidden={!isVisible}
      className={cn(
        "overflow-hidden transition-[height,width,opacity,transform] duration-150 ease-out md:shrink-0",
        isVisible
          ? "h-[360px] translate-y-0 opacity-100 md:h-auto md:w-[360px] md:translate-x-0"
          : "h-0 translate-y-3 opacity-0 md:h-auto md:w-0 md:translate-x-3 md:translate-y-0"
      )}>
      <div className="h-full w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 md:w-[360px]">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{action.name}</h2>
          <p className="mt-1 text-sm text-slate-600">{action.type}</p>
        </div>
        <div className="mt-6 flex flex-col gap-6">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">{t("common.email")}</span>
            <Input disabled value={action.email} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">{t("common.subject")}</span>
            <Input disabled value={action.subject} />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {action.body}
          </div>
        </div>
      </div>
    </aside>
  );
};
